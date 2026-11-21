package app.galaxantic.echo;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.accessibility.AccessibilityManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONException;

/**
 * The few things a web view cannot do: read whether TalkBack is on, take the volume keys, speak, vibrate reliably
 * (navigator.vibrate is not guaranteed inside a WebView) and ask for the microphone.
 */
@CapacitorPlugin(
    name = "EchoNative",
    permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class EchoNativePlugin extends Plugin {
    // Speech engines can hang or die silently; JS waits for speechEnd, so a missing one must never block it forever.
    private static final long SPEECH_WATCHDOG_BASE_MS = 10000L;
    private static final long SPEECH_WATCHDOG_PER_CHAR_MS = 200L;
    private static final long MAX_VIBRATION_STEP_MS = 10000L;

    private final Handler main = new Handler(Looper.getMainLooper());
    private AccessibilityManager accessibility;
    private AccessibilityManager.TouchExplorationStateChangeListener touchListener;
    private boolean lastScreenReader = false;
    private Vibrator vibrator;
    private volatile boolean volumeKeysCaptured = false;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private boolean ttsFailed = false;
    private final List<Runnable> waitingForTts = new ArrayList<>();
    // Utterance ids that were started and have not yet reported an end; guarded by itself.
    private final Set<Integer> pendingSpeech = new HashSet<>();

    @Override
    public void load() {
        Context context = getContext();
        accessibility = (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
        vibrator = findVibrator(context);
        touchListener = enabled -> {
            lastScreenReader = enabled;
            JSObject data = new JSObject();
            data.put("on", enabled);
            notifyListeners("screenReaderChanged", data);
        };
        if (accessibility != null) {
            lastScreenReader = accessibility.isTouchExplorationEnabled();
            accessibility.addTouchExplorationStateChangeListener(touchListener);
        }
        startSpeech(context);
    }

    @SuppressWarnings("deprecation")
    private static Vibrator findVibrator(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    /** The screen reader can be switched in system settings while we are paused, and a listener may miss it. */
    @Override
    protected void handleOnResume() {
        if (accessibility == null) {
            return;
        }
        boolean now = accessibility.isTouchExplorationEnabled();
        if (now != lastScreenReader) {
            lastScreenReader = now;
            JSObject data = new JSObject();
            data.put("on", now);
            notifyListeners("screenReaderChanged", data);
        }
    }

    /** Leaving the app must silence speech and buzzing; JS is released from any speech it was waiting on. */
    @Override
    protected void handleOnPause() {
        cancelVibrationNow();
        stopAllSpeech();
    }

    /**
     * Android WebView has no speechSynthesis, so Echo's own voice goes through the system text-to-speech engine here.
     */
    private void startSpeech(Context context) {
        try {
            tts = new TextToSpeech(context, this::onTtsInit);
        } catch (RuntimeException e) {
            failSpeech();
        }
    }

    private void onTtsInit(int status) {
        if (status != TextToSpeech.SUCCESS || tts == null) {
            failSpeech();
            return;
        }
        chooseLanguage();
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {}

            @Override
            public void onDone(String utteranceId) {
                speechEnded(utteranceId);
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onError(String utteranceId) {
                speechEnded(utteranceId);
            }

            @Override
            public void onError(String utteranceId, int errorCode) {
                speechEnded(utteranceId);
            }

            @Override
            public void onStop(String utteranceId, boolean interrupted) {
                speechEnded(utteranceId);
            }
        });
        List<Runnable> toRun;
        synchronized (waitingForTts) {
            ttsReady = true;
            toRun = new ArrayList<>(waitingForTts);
            waitingForTts.clear();
        }
        for (Runnable r : toRun) {
            r.run();
        }
    }

    /** Prefer English (the app's text is English), then the phone's language, then whatever the engine defaults to. */
    private void chooseLanguage() {
        Locale[] candidates = { Locale.US, Locale.ENGLISH, Locale.getDefault() };
        for (Locale locale : candidates) {
            try {
                int result = tts.setLanguage(locale);
                if (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED) {
                    return;
                }
            } catch (RuntimeException ignored) {
                // Try the next language.
            }
        }
    }

    /** No engine at all: every queued and future utterance ends immediately so JS never waits on silence. */
    private void failSpeech() {
        List<Runnable> toRun;
        synchronized (waitingForTts) {
            ttsFailed = true;
            toRun = new ArrayList<>(waitingForTts);
            waitingForTts.clear();
        }
        for (Runnable r : toRun) {
            r.run();
        }
    }

    private void speechEnded(String utteranceId) {
        int id;
        try {
            id = Integer.parseInt(utteranceId);
        } catch (NumberFormatException | NullPointerException e) {
            return;
        }
        synchronized (pendingSpeech) {
            if (!pendingSpeech.remove(id)) {
                return;
            }
        }
        JSObject data = new JSObject();
        data.put("id", id);
        notifyListeners("speechEnd", data);
    }

    private void stopAllSpeech() {
        synchronized (waitingForTts) {
            waitingForTts.clear();
        }
        try {
            if (tts != null && ttsReady) {
                tts.stop();
            }
        } catch (RuntimeException ignored) {
            // Engine died; the ids are released below anyway.
        }
        List<Integer> ids;
        synchronized (pendingSpeech) {
            ids = new ArrayList<>(pendingSpeech);
        }
        for (int id : ids) {
            speechEnded(String.valueOf(id));
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (accessibility != null && touchListener != null) {
            accessibility.removeTouchExplorationStateChangeListener(touchListener);
        }
        cancelVibrationNow();
        volumeKeysCaptured = false;
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (RuntimeException ignored) {
                // Already gone.
            }
            tts = null;
        }
    }

    /** TalkBack (and other touch-exploration screen readers) on or off. */
    @PluginMethod
    public void isScreenReaderOn(PluginCall call) {
        JSObject result = new JSObject();
        result.put("on", accessibility != null && accessibility.isTouchExplorationEnabled());
        call.resolve(result);
    }

    /** Queues text to be spoken; a "speechEnd" event with the same id follows when it finishes or is cut off. */
    @PluginMethod
    public void speak(PluginCall call) {
        final String text = call.getString("text", "");
        final int id = call.getInt("id", 0);
        final Float rateOrNull = call.getFloat("rate", 1.0f);
        final float rate = rateOrNull == null || rateOrNull <= 0f ? 1.0f : rateOrNull;
        synchronized (pendingSpeech) {
            pendingSpeech.add(id);
        }
        Runnable say = () -> {
            boolean started = false;
            if (!ttsFailed && tts != null && text != null && !text.trim().isEmpty()) {
                try {
                    tts.setSpeechRate(rate);
                    started = tts.speak(text, TextToSpeech.QUEUE_ADD, null, String.valueOf(id)) == TextToSpeech.SUCCESS;
                } catch (RuntimeException e) {
                    started = false;
                }
            }
            if (!started) {
                speechEnded(String.valueOf(id));
                return;
            }
            long limit = SPEECH_WATCHDOG_BASE_MS + (long) (text.length() * SPEECH_WATCHDOG_PER_CHAR_MS / rate);
            main.postDelayed(() -> speechEnded(String.valueOf(id)), limit);
        };
        boolean runNow;
        synchronized (waitingForTts) {
            runNow = ttsReady || ttsFailed;
            if (!runNow) {
                waitingForTts.add(say);
            }
        }
        call.resolve();
        if (runNow) {
            say.run();
        }
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        stopAllSpeech();
        call.resolve();
    }

    /** Closes the app. JS calls this only after the user pressed Back twice on the top screen. */
    @PluginMethod
    public void exitApp(PluginCall call) {
        call.resolve();
        getActivity().runOnUiThread(() -> getActivity().finish());
    }

    /** The phone's back button or back swipe, handed to JS to decide what Back means. */
    void handleBack() {
        if (!hasListeners("backPressed")) {
            // The page has not subscribed yet (or is reloading); never trap the user inside a dead screen.
            getActivity().moveTaskToBack(true);
            return;
        }
        notifyListeners("backPressed", new JSObject());
    }

    @PluginMethod
    public void setVolumeKeysCaptured(PluginCall call) {
        volumeKeysCaptured = Boolean.TRUE.equals(call.getBoolean("captured", false));
        call.resolve();
    }

    /** Pattern is alternating on/off milliseconds starting with "on", like navigator.vibrate. */
    @PluginMethod
    @SuppressWarnings("deprecation")
    public void vibrate(PluginCall call) {
        if (vibrator == null || !vibrator.hasVibrator()) {
            call.resolve();
            return;
        }
        JSArray pattern = call.getArray("pattern");
        if (pattern == null || pattern.length() == 0) {
            call.resolve();
            return;
        }
        try {
            // Waveform timings start with an initial delay, so prepend 0 to start straight away.
            long[] timings = new long[pattern.length() + 1];
            boolean anyOn = false;
            for (int i = 0; i < pattern.length(); i++) {
                long step = Math.max(0L, Math.min(MAX_VIBRATION_STEP_MS, pattern.getLong(i)));
                timings[i + 1] = step;
                if (i % 2 == 0 && step > 0) {
                    anyOn = true;
                }
            }
            if (!anyOn) {
                call.resolve();
                return;
            }
            vibrator.cancel();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                VibrationEffect effect = VibrationEffect.createWaveform(timings, -1);
                // Accessibility usage keeps these buzzes from being dropped when touch feedback is off.
                AudioAttributes attributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
                vibrator.vibrate(effect, attributes);
            } else {
                vibrator.vibrate(timings, -1);
            }
            call.resolve();
        } catch (JSONException e) {
            call.reject("Bad vibration pattern", e);
        } catch (RuntimeException e) {
            call.reject("Vibration failed", e);
        }
    }

    @PluginMethod
    public void cancelVibration(PluginCall call) {
        cancelVibrationNow();
        call.resolve();
    }

    private void cancelVibrationNow() {
        try {
            if (vibrator != null) {
                vibrator.cancel();
            }
        } catch (RuntimeException ignored) {
            // Nothing to cancel.
        }
    }

    /** Microphone permission state, so the page can explain a denial instead of failing silently. */
    @PluginMethod
    public void checkMicPermission(PluginCall call) {
        call.resolve(micState());
    }

    @PluginMethod
    public void requestMicPermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            call.resolve(micState());
            return;
        }
        requestPermissionForAlias("microphone", call, "micPermissionResult");
    }

    @PermissionCallback
    private void micPermissionResult(PluginCall call) {
        call.resolve(micState());
    }

    private JSObject micState() {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("microphone") == PermissionState.GRANTED);
        return result;
    }

    /** After "don't ask again" the system dialog never returns; the only way back is the app's settings page. */
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (RuntimeException e) {
            call.reject("Cannot open settings", e);
        }
    }

    boolean areVolumeKeysCaptured() {
        return volumeKeysCaptured;
    }

    /** Called from MainActivity; true means the key was ours and the system volume must not change. */
    boolean handleVolumeKey(boolean up, boolean isRepeat) {
        if (!volumeKeysCaptured) {
            return false;
        }
        if (!isRepeat) {
            JSObject data = new JSObject();
            data.put("key", up ? "up" : "down");
            notifyListeners("volumeKey", data);
        }
        return true;
    }
}
