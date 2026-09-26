package com.sparky.jotrea;

import android.content.pm.PackageInfo;
import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opt-in debug-build evidence collection; no content, storage, or health data.
 * From chrome://inspect's console:
 * await Capacitor.nativePromise("JotreaRenderDiagnostics", "inspect", {})
 * await Capacitor.nativePromise("JotreaRenderDiagnostics", "setRenderer", {mode:"software"})
 * await Capacitor.nativePromise("JotreaRenderDiagnostics", "setRenderer", {mode:"default"})
 *
 * Capture adb screenshots before/after on the SAME route and scroll position.
 * Software affects only this WebView and lasts only for this Activity instance.
 * It can reduce scrolling/animation performance; it is NOT a release fix.
 */
@CapacitorPlugin(name = "JotreaRenderDiagnostics")
public class RenderDiagnosticsPlugin extends Plugin {
    private boolean allow(PluginCall call) {
        if ((getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
            call.reject("Renderer diagnostics require a debug build");
            return false;
        }
        return true;
    }

    @PluginMethod
    public void setRenderer(PluginCall call) {
        if (!allow(call)) return;
        String mode = call.getString("mode");
        if (!"software".equals(mode) && !"default".equals(mode)) {
            call.reject("Expected software or default");
            return;
        }
        getActivity().runOnUiThread(() -> {
            WebView view = getBridge().getWebView();
            view.setLayerType("software".equals(mode) ? View.LAYER_TYPE_SOFTWARE : View.LAYER_TYPE_NONE, null);
            JSObject result = new JSObject();
            result.put("mode", mode);
            result.put("layerType", view.getLayerType());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void inspect(PluginCall call) {
        if (!allow(call)) return;
        getActivity().runOnUiThread(() -> {
            WebView view = getBridge().getWebView();
            JSObject result = new JSObject();
            result.put("diagnosticRevision", "android-render-2026-09-26");
            result.put("sdk", Build.VERSION.SDK_INT);
            result.put("osRelease", Build.VERSION.RELEASE);
            result.put("model", Build.MODEL);
            result.put("fingerprint", Build.FINGERPRINT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PackageInfo provider = WebView.getCurrentWebViewPackage();
                result.put("webViewProvider", provider == null ? "unavailable" : provider.packageName);
                result.put("webViewVersion", provider == null ? "unavailable" : provider.versionName);
            }
            result.put("layerType", view.getLayerType());
            // This reports attachment to an accelerated window, not whether an
            // explicit SOFTWARE layer uses the GPU. Record both, never conflate.
            result.put("hardwareAcceleratedWindow", view.isHardwareAccelerated());
            result.put("opaque", view.isOpaque());
            result.put("alpha", view.getAlpha());
            result.put("width", view.getWidth());
            result.put("height", view.getHeight());
            result.put("nativeScrollX", view.getScrollX());
            result.put("nativeScrollY", view.getScrollY());
            ViewGroup.LayoutParams params = view.getLayoutParams();
            if (params instanceof ViewGroup.MarginLayoutParams) {
                ViewGroup.MarginLayoutParams margins = (ViewGroup.MarginLayoutParams) params;
                result.put("margins", margins.leftMargin + "," + margins.topMargin + "," +
                        margins.rightMargin + "," + margins.bottomMargin);
            }
            // Geometry/style only. Do not collect headings, form values, HTML,
            // localStorage, URL query strings, or medical data in diagnostics.
            view.evaluateJavascript(
                    "(() => { const box = e => { if (!e) return null; const s = getComputedStyle(e);" +
                    "const r = e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height," +
                    "clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop," +
                    "background:s.backgroundColor,opacity:s.opacity,overflowY:s.overflowY,transform:s.transform}; };" +
                    "return {viewport:{width:innerWidth,height:innerHeight}," +
                    "html:box(document.documentElement),body:box(document.body),root:box(document.getElementById('root'))," +
                    "pageScrollers:Array.from(document.querySelectorAll('[data-jotrea-page-scroll]')).map(box)," +
                    "documentScroller:box(document.scrollingElement)}; })()",
                    value -> {
                        try {
                            result.put("dom", new JSObject(value));
                            call.resolve(result);
                        } catch (Exception error) {
                            call.reject("Unable to collect DOM geometry", error);
                        }
                    });
        });
    }
}