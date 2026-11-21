package app.galaxantic.echo;

import android.content.Context;
import android.os.Build;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.accessibility.AccessibilityManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONException;

/**
 * The few things a web view cannot do: read whether TalkBack is on, take the volume keys, and vibrate reliably
 * (navigator.vibrate is not guaranteed inside a WebView).
 */
@CapacitorPlugin(name = "EchoNative")
public class EchoNativePlugin extends Plugin {
    private AccessibilityManager accessibility;
    private AccessibilityManager.TouchExplorationStateChangeListener touchListener;
    private Vibrator vibrator;
    private boolean volumeKeysCaptured = false;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private final List<Runnable> waitingForTts = new ArrayList<>();

    @Override
    public void load() {
        Context context = getContext();
        accessibility = (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
        vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        touchListener = enabled -> {
            JSObject data = new JSObject();
            data.put("on", enabled);
            notifyListeners("screenReaderChanged", data);
        };
        if (accessibility != null) {
            accessibility.addTouchExplorationStateChangeListener(touchListener);
        }
        startSpeech(context);
    }

    /**
     * Android WebView has no speechSynthesis, so Echo's own voice goes through the system text-to-speech engine here.
     */
    private void startSpeech(Context context) {
        tts = new TextToSpeech(context, status -> {
            if (status != TextToSpeech.SUCCESS) {
                return;
            }
            tts.setLanguage(Locale.US);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {}

                @Override
                public void onDone(String utteranceId) {
                    speechEnded(utteranceId);
                }

                @Override
                public void onError(String utteranceId) {
                    speechEnded(utteranceId);
                }

                @Override
                public void onStop(String utteranceId, boolean interrupted) {
                    speechEnded(utteranceId);
                }
            });
            synchronized (waitingForTts) {
                ttsReady = true;
                for (Runnable r : waitingForTts) {
                    r.run();
                }
                waitingForTts.clear();
            }
        });
    }

    private void speechEnded(String utteranceId) {
        try {
            JSObject data = new JSObject();
            data.put("id", Integer.parseInt(utteranceId));
            notifyListeners("speechEnd", data);
        } catch (NumberFormatException ignored) {
            // Not one of ours.
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (accessibility != null && touchListener != null) {
            accessibility.removeTouchExplorationStateChangeListener(touchListener);
        }
        cancelVibrationNow();
        if (tts != null) {
            tts.stop();
            tts.shutdown();
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
        final float rate = call.getFloat("rate", 1.0f);
        Runnable say = () -> {
            tts.setSpeechRate(rate);
            tts.speak(text, TextToSpeech.QUEUE_ADD, null, String.valueOf(id));
        };
        synchronized (waitingForTts) {
            if (ttsReady) {
                say.run();
            } else {
                waitingForTts.add(say);
            }
        }
        call.resolve();
    }

    /** Closes the app. JS calls this only after the user pressed Back twice on the top screen. */
    @PluginMethod
    public void exitApp(PluginCall call) {
        call.resolve();
        getActivity().finish();
    }

    /** The phone's back button or back swipe, handed to JS to decide what Back means. */
    void handleBack() {
        notifyListeners("backPressed", new JSObject());
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        synchronized (waitingForTts) {
            waitingForTts.clear();
        }
        if (tts != null && ttsReady) {
            tts.stop();
        }
        call.resolve();
    }

    @PluginMethod
    public void setVolumeKeysCaptured(PluginCall call) {
        volumeKeysCaptured = Boolean.TRUE.equals(call.getBoolean("captured", false));
        call.resolve();
    }

    /** Pattern is alternating on/off milliseconds starting with "on", like navigator.vibrate. */
    @PluginMethod
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
            for (int i = 0; i < pattern.length(); i++) {
                timings[i + 1] = pattern.getLong(i);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(timings, -1));
            } else {
                vibrator.vibrate(timings, -1);
            }
            call.resolve();
        } catch (JSONException e) {
            call.reject("Bad vibration pattern", e);
        }
    }

    @PluginMethod
    public void cancelVibration(PluginCall call) {
        cancelVibrationNow();
        call.resolve();
    }

    private void cancelVibrationNow() {
        if (vibrator != null) {
            vibrator.cancel();
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
