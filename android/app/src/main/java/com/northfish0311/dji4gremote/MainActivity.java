package com.northfish0311.dji4gremote;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.webkit.*;
import android.widget.*;
import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private LinearLayout root;
    private TextView status;
    private EditText address, password;
    private Button connect, scan;
    private WebView web;
    private PairingVault vault;
    private URI host;
    private String token;
    private int generation;
    private boolean connecting;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        vault = new PairingVault(this);
        showPairing();
        try {
            JSONObject saved = vault.load();
            if (saved != null) {
                address.setText(saved.getString("host"));
                password.setText(saved.getString("token"));
                pair(address.getText().toString(), password.getText().toString());
            }
        } catch (Exception error) { vault.clear(); status.setText("保存的配对已失效，请重新扫码。"); }
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView text(String value, int size, int color) {
        TextView label = new TextView(this); label.setText(value); label.setTextSize(size); label.setTextColor(color);
        label.setPadding(0, dp(8), 0, dp(8)); return label;
    }
    private Button button(String title, Runnable action) {
        Button button = new Button(this); button.setText(title); button.setAllCaps(false); button.setMinHeight(dp(48));
        button.setOnClickListener(v -> action.run()); return button;
    }
    private void shell() {
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.rgb(246, 248, 250));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets;
        });
        setContentView(root);
    }
    private void showPairing() {
        shell();
        ScrollView scroll = new ScrollView(this); root.addView(scroll);
        LinearLayout form = new LinearLayout(this); form.setOrientation(LinearLayout.VERTICAL); form.setPadding(dp(24), dp(24), dp(24), dp(24)); scroll.addView(form);
        form.addView(text("大疆 4G 远程助手", 26, Color.rgb(25, 35, 40)));
        form.addView(text("连接 Windows 电脑", 16, Color.DKGRAY));
        scan = button("扫描配对码", () -> new IntentIntegrator(this).setDesiredBarcodeFormats(IntentIntegrator.QR_CODE).setPrompt("扫描电脑助手的配对二维码").setBeepEnabled(false).initiateScan()); form.addView(scan);
        form.addView(text("手动配对", 18, Color.DKGRAY));
        address = new EditText(this); address.setHint("电脑的局域网地址"); address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI); address.setSingleLine(true); form.addView(address);
        password = new EditText(this); password.setHint("配对密码"); password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD); password.setSingleLine(true); form.addView(password);
        password.setSaveEnabled(false);
        address.setSaveEnabled(false);
        connect = button("连接", () -> pair(address.getText().toString(), password.getText().toString())); form.addView(connect);
        status = text("", 14, Color.rgb(93, 103, 112)); form.addView(status);
        form.addView(button("连接说明", () -> new AlertDialog.Builder(this).setTitle("远程管理")
            .setMessage("模块插在 Windows 电脑上，保持电脑助手运行。两台设备连接同一可信局域网，扫描电脑显示的配对二维码。\n\n本版本不支持模块直插安卓手机。局域网 HTTP 不等于加密连接，请勿暴露到公网。")
            .setPositiveButton("知道了", null).show()));
    }
    private void pair(String rawAddress, String rawToken) {
        if (connecting) return;
        final URI base;
        final String secret = rawToken.trim();
        try { base = PairingAddress.normalize(rawAddress); PairingAddress.validateToken(secret); }
        catch (IllegalArgumentException error) { status.setText(error.getMessage()); return; }
        connecting = true; connect.setEnabled(false); scan.setEnabled(false); status.setText("正在验证电脑…");
        final int request = ++generation;
        worker.execute(() -> {
            HttpURLConnection connection = null;
            String failure = null;
            try {
                connection = (HttpURLConnection) base.resolve("/api/pairing").toURL().openConnection();
                connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(12000); connection.setReadTimeout(12000);
                connection.setRequestProperty("X-Console-Token", secret);
                int code = connection.getResponseCode();
                if (code != 200) throw new Exception(code == 401 || code == 403 ? "配对密码失效，请扫描电脑上的新二维码。" : "电脑拒绝连接，请检查助手是否正常运行。");
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                try (java.io.InputStream input = connection.getInputStream()) {
                    byte[] buffer = new byte[4096]; int size;
                    while ((size = input.read(buffer)) != -1) { output.write(buffer, 0, size); if (output.size() > 65536) throw new Exception("电脑响应异常。"); }
                }
                if (!new JSONObject(output.toString("UTF-8")).optBoolean("ok")) throw new Exception("电脑未接受配对。");
            } catch (Exception error) {
                failure = error instanceof java.io.IOException ? "无法连接电脑。请检查同一 Wi-Fi、电脑助手和防火墙，然后重试。" : error.getMessage();
            } finally { if (connection != null) connection.disconnect(); }
            final String message = failure;
            runOnUiThread(() -> {
                if (isDestroyed() || request != generation) return;
                connecting = false; connect.setEnabled(true); scan.setEnabled(true);
                if (message != null) { status.setText(message); return; }
                try { vault.save(base.toString(), secret); }
                catch (Exception error) { status.setText("无法安全保存配对，请重试。"); return; }
                host = base; token = secret; password.setText(""); showConsole();
            });
        });
    }
    private void showConsole() {
        shell();
        LinearLayout toolbar = new LinearLayout(this); toolbar.setPadding(dp(12), 0, dp(12), 0); toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);
        TextView title = text("远程管理", 18, Color.DKGRAY); toolbar.addView(title, new LinearLayout.LayoutParams(0, -2, 1));
        toolbar.addView(button("重连", this::reload));
        toolbar.addView(button("断开", () -> new AlertDialog.Builder(this).setTitle("忘记这台电脑？").setMessage("会清除手机保存的配对，不改变模块设置。")
            .setNegativeButton("取消", null).setPositiveButton("忘记", (d, w) -> forget()).show())); root.addView(toolbar);
        status = text("正在连接…", 14, Color.DKGRAY); status.setPadding(dp(16), dp(4), dp(16), dp(4)); root.addView(status);
        web = new WebView(this);
        WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebChromeClient(new WebChromeClient());
        final URI allowed = host;
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return !PairingAddress.sameOrigin(allowed, request.getUrl().toString()); }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return PairingAddress.sameOrigin(allowed, request.getUrl().toString()) ? null : new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public void onPageFinished(WebView view, String url) { if (!loadFailed) status.setVisibility(View.GONE); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) { if (request.isForMainFrame()) failed("连接中断，请保持电脑助手运行，然后点击重连。"); }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) { if (request.isForMainFrame()) failed("电脑返回错误。密码失效时请断开后重新扫码。"); }
        });
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1)); reload();
    }
    private boolean loadFailed;
    private void failed(String message) { loadFailed = true; status.setText(message); status.setVisibility(View.VISIBLE); }
    private void reload() {
        if (web == null || host == null) return;
        loadFailed = false; status.setText("正在连接…"); status.setVisibility(View.VISIBLE);
        Uri url = Uri.parse(host.toString()).buildUpon().appendQueryParameter("token", token).appendQueryParameter("native", "android").fragment("overview").build();
        web.loadUrl(url.toString());
    }
    private void forget() {
        generation++; vault.clear(); token = null; host = null;
        if (web != null) { web.stopLoading(); web.clearCache(true); web.clearHistory(); web.destroy(); web = null; }
        WebStorage.getInstance().deleteAllData(); CookieManager.getInstance().removeAllCookies(null); showPairing();
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result == null) { super.onActivityResult(requestCode, resultCode, data); return; }
        if (result.getContents() == null) return;
        try {
            Uri qr = Uri.parse(result.getContents());
            if (!"dji4g".equals(qr.getScheme()) || !"pair".equals(qr.getHost())) throw new IllegalArgumentException();
            String raw = qr.getQueryParameter("url"), secret = qr.getQueryParameter("token");
            if (raw == null || secret == null) throw new IllegalArgumentException();
            address.setText(raw); password.setText(secret); pair(raw, secret);
        } catch (Exception error) { status.setText("二维码无效，请扫描电脑助手显示的配对码。"); }
    }
    @Override protected void onDestroy() { generation++; worker.shutdownNow(); if (web != null) web.destroy(); super.onDestroy(); }
}
