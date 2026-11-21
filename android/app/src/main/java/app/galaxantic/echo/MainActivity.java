package app.galaxantic.echo;

import android.media.AudioManager;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    // A volume key whose down event we swallowed must also have its up event swallowed, even if capture was switched
    // off in between; otherwise the system shows its slider for half a key press.
    private boolean upSwallowed = false;
    private boolean downSwallowed = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins must be registered before super.onCreate builds the bridge.
        registerPlugin(EchoNativePlugin.class);
        super.onCreate(savedInstanceState);
        // Training sessions are long and silent between answers; the screen must not lock mid-run.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Hardware volume keys control the media stream our sounds play on, even before any sound has played.
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
        // Added after the bridge's own handler, so it runs first. Back must never silently close Echo.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                EchoNativePlugin plugin = echoPlugin();
                if (plugin != null) {
                    plugin.handleBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }

    private EchoNativePlugin echoPlugin() {
        if (getBridge() == null) {
            return null;
        }
        PluginHandle handle = getBridge().getPlugin("EchoNative");
        if (handle != null && handle.getInstance() instanceof EchoNativePlugin) {
            return (EchoNativePlugin) handle.getInstance();
        }
        return null;
    }

    /**
     * Intercepted before any view sees the key, so the WebView or TalkBack cannot take it first.
     * Key-down fires the event once (repeats are swallowed silently); key-up is swallowed to stop the system slider.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int code = event.getKeyCode();
        if (code != KeyEvent.KEYCODE_VOLUME_UP && code != KeyEvent.KEYCODE_VOLUME_DOWN) {
            return super.dispatchKeyEvent(event);
        }
        boolean up = code == KeyEvent.KEYCODE_VOLUME_UP;
        EchoNativePlugin plugin = echoPlugin();
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            if (plugin != null && plugin.handleVolumeKey(up, event.getRepeatCount() > 0)) {
                if (up) {
                    upSwallowed = true;
                } else {
                    downSwallowed = true;
                }
                return true;
            }
        } else if (event.getAction() == KeyEvent.ACTION_UP) {
            boolean swallowed = up ? upSwallowed : downSwallowed;
            if (up) {
                upSwallowed = false;
            } else {
                downSwallowed = false;
            }
            if (swallowed) {
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }
}
