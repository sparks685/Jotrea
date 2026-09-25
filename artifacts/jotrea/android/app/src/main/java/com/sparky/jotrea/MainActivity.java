package com.sparky.jotrea;

import android.content.res.Configuration;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemBarsPlugin.class);
        super.onCreate(savedInstanceState);
        SystemBarsPlugin.apply(this);
    }

    @Override
    public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        // uiMode is handled by this activity, so Android does not recreate it.
        SystemBarsPlugin.apply(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        SystemBarsPlugin.apply(this);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Splash dismissal and external activities can restore theme/system
        // appearance after onResume; reassert the persisted selection on focus.
        if (hasFocus) {
            SystemBarsPlugin.apply(this);
        }
    }
}
