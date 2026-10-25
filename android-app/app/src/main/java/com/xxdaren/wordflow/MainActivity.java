package com.xxdaren.wordflow;

import android.app.Activity;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceResponse;
import java.io.InputStream;
import java.io.IOException;
import android.content.Intent;
import android.net.Uri;
import java.util.Locale;

public final class MainActivity extends Activity {
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private WebView webView;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())) {
                    String path = uri.getPath();
                    if (path != null && path.startsWith("/assets/web/")) {
                        String assetPath = path.substring("/assets/".length());
                        try {
                            InputStream stream = getAssets().open(assetPath);
                            return new WebResourceResponse(mimeType(assetPath), "UTF-8", stream);
                        } catch (IOException ignored) { return null; }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                return false;
            }
        });
        webView.addJavascriptInterface(new AndroidConfigBridge(), "AndroidConfig");
        webView.addJavascriptInterface(new AndroidTtsBridge(), "AndroidTTS");
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int language = tts.setLanguage(Locale.US);
                ttsReady = language != TextToSpeech.LANG_MISSING_DATA && language != TextToSpeech.LANG_NOT_SUPPORTED;
            }
        });
        setContentView(webView);
        webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html");
    }

    private static String mimeType(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }

    private final class AndroidConfigBridge {
        @JavascriptInterface public String apiBase() { return BuildConfig.WORDFLOW_API_URL; }
    }
    private final class AndroidTtsBridge {
        @JavascriptInterface public boolean speak(String text, String language) {
            if (tts == null || !ttsReady) return false;
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "wordflow-" + System.currentTimeMillis());
            return true;
        }
    }
    @Override protected void onDestroy() {
        if (tts != null) { ttsReady = false; tts.stop(); tts.shutdown(); }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
