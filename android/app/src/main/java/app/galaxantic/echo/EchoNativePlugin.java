package app.galaxantic.echo;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.accessibility.AccessibilityManager;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
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
    }

    @Override
    protected void handleOnDestroy() {
        if (accessibility != null && touchListener != null) {
            accessibility.removeTouchExplorationStateChangeListener(touchListener);
        }
        cancelVibrationNow();
    }

    /** TalkBack (and other touch-exploration screen readers) on or off. */
    @PluginMethod
    public void isScreenReaderOn(PluginCall call) {
        JSObject result = new JSObject();
        result.put("on", accessibility != null && accessibility.isTouchExplorationEnabled());
        call.resolve(result);
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
