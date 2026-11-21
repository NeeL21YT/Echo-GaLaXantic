package app.galaxantic.echo;

import android.os.Bundle;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugins must be registered before super.onCreate builds the bridge.
        registerPlugin(EchoNativePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            PluginHandle handle = getBridge().getPlugin("EchoNative");
            if (handle != null && handle.getInstance() instanceof EchoNativePlugin) {
                EchoNativePlugin plugin = (EchoNativePlugin) handle.getInstance();
                boolean handled = plugin.handleVolumeKey(keyCode == KeyEvent.KEYCODE_VOLUME_UP, event.getRepeatCount() > 0);
                if (handled) {
                    return true;
                }
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    /** The system changes the volume and shows its slider on key-up, so a captured key must be swallowed there too. */
    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            PluginHandle handle = getBridge().getPlugin("EchoNative");
            if (handle != null && handle.getInstance() instanceof EchoNativePlugin
                    && ((EchoNativePlugin) handle.getInstance()).areVolumeKeysCaptured()) {
                return true;
            }
        }
        return super.onKeyUp(keyCode, event);
    }
}
