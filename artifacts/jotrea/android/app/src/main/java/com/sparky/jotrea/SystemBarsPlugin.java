package com.sparky.jotrea;

import android.app.Activity;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android-only system bar adapter. Persist the *selection*, not its resolved
 * color, so system mode follows uiMode changes even while the WebView is paused.
 */
@CapacitorPlugin(name = "JotreaSystemBars")
public class SystemBarsPlugin extends Plugin {
    private static final String PREFS = "jotrea_system_bars";
    private static final String KEY_MODE = "mode";
    private static final int LIGHT = Color.rgb(255, 252, 245);
    // Matches --background: 240 39% 10% in the WebView.
    private static final int DARK = Color.rgb(16, 16, 35);

    @PluginMethod
    public void setMode(PluginCall call) {
        String mode = call.getString("mode");
        if (!"light".equals(mode) && !"dark".equals(mode) && !"system".equals(mode)) {
            call.reject("Expected light, dark, or system mode");
            return;
        }
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_MODE, mode).apply();
        getActivity().runOnUiThread(() -> {
            apply(getActivity());
            call.resolve(new JSObject());
        });
    }

    static void apply(Activity activity) {
        String mode = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_MODE, "system");
        boolean dark = "dark".equals(mode) ||
                ("system".equals(mode) &&
                        (activity.getResources().getConfiguration().uiMode &
                                Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);

        Window window = activity.getWindow();
        int color = dark ? DARK : LIGHT;
        // On API 35+ the OS makes the bars transparent. The window surface behind
        // the inset WebView must match the selected theme, including 3-button nav.
        window.setBackgroundDrawable(new ColorDrawable(color));
        window.setStatusBarColor(color);
        window.setNavigationBarColor(color);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
        // On API 30+ the window insets controller owns icon appearance. Writing
        // legacy decor systemUiVisibility after a controller has been installed
        // can leave the launch theme's dark-icon appearance stuck on a dark bar.
        // Compat also maps this to the legacy flags on API 24–29.
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(!dark);
        // Light navigation icons require API 26. On API 24–25 use dark nav bar
        // with the OS's white icons even if the rest of the app is light.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            controller.setAppearanceLightNavigationBars(!dark);
        } else {
            window.setNavigationBarColor(DARK);
        }
    }
}