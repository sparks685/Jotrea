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
}
