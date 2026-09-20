package com.northfish0311.dji4gremote;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.content.ClipboardManager;
import android.content.ClipData;
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
    private LinearLayout manual;
    private ProgressBar progress;
    private WebView web;
    private PairingVault vault;
    private URI host;
    private String token;
    private int generation;
    private boolean connecting;
    private static final int INK = Color.rgb(32, 37, 44);
    private static final int MUTED = Color.rgb(116, 123, 134);
    private static final int ACCENT = Color.rgb(23, 100, 237);

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
    private GradientDrawable surface(int color) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color); drawable.setCornerRadius(dp(8)); return drawable;
    }
    private Button button(String title, Runnable action) {
        Button button = new Button(this); button.setText(title); button.setAllCaps(false); button.setMinHeight(dp(48));
        button.setTextSize(15); button.setLetterSpacing(0);
        button.setStateListAnimator(null); button.setElevation(0);
        button.setPadding(dp(16), dp(12), dp(16), dp(12));
        styleButton(button, Color.TRANSPARENT, ACCENT, false);
        button.setOnClickListener(v -> action.run()); return button;
    }
    private void styleButton(Button button, int fill, int foreground, boolean bordered) {
        int[][] states = new int[][]{new int[]{-android.R.attr.state_enabled}, new int[]{}};
        GradientDrawable normal = surface(fill);
        if (bordered) normal.setStroke(dp(1), Color.rgb(225, 230, 237));
        android.graphics.drawable.StateListDrawable backgrounds = new android.graphics.drawable.StateListDrawable();
        backgrounds.addState(states[0], surface(Color.rgb(237, 240, 245)));
        backgrounds.addState(states[1], normal);
        button.setBackgroundTintList(null);
        button.setBackground(new android.graphics.drawable.RippleDrawable(
            android.content.res.ColorStateList.valueOf(Color.argb(28, 23, 100, 237)),
            backgrounds, surface(Color.WHITE)));
        button.setTextColor(new android.content.res.ColorStateList(states, new int[]{MUTED, foreground}));
    }
    private ImageButton icon(int resource, String label, Runnable action) {
        ImageButton button = new ImageButton(this); button.setImageResource(resource); button.setColorFilter(MUTED);
        android.util.TypedValue value = new android.util.TypedValue();
        getTheme().resolveAttribute(android.R.attr.selectableItemBackgroundBorderless, value, true);
        button.setBackgroundResource(value.resourceId); button.setContentDescription(label);
        if (android.os.Build.VERSION.SDK_INT >= 26) button.setTooltipText(label);
        button.setLayoutParams(new LinearLayout.LayoutParams(dp(48), dp(48)));
        button.setOnClickListener(v -> action.run()); return button;
    }
    private void help() {
        new AlertDialog.Builder(this).setTitle("连接电脑助手")
            .setMessage("1. 模块插在 Windows 电脑上，打开电脑助手。\n2. 手机和电脑连接同一可信 Wi-Fi。\n3. 扫描电脑上的配对二维码。\n\n当前版本是远程管理，不支持模块直插手机。HTTP 局域网连接不等于加密传输。")
            .setPositiveButton("知道了", null).show();
    }
    private void shell() {
        root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.rgb(251, 252, 254));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets;
        });
        setContentView(root);
    }
    private void showPairing() {
        shell();
        ScrollView scroll = new ScrollView(this); scroll.setFillViewport(true); root.addView(scroll, new LinearLayout.LayoutParams(-1, -1));
        FrameLayout container = new FrameLayout(this); scroll.addView(container);
        LinearLayout form = new LinearLayout(this); form.setOrientation(LinearLayout.VERTICAL); form.setPadding(dp(24), dp(20), dp(24), dp(32));
        FrameLayout.LayoutParams formSize = new FrameLayout.LayoutParams(dp(Math.min(getResources().getConfiguration().screenWidthDp, 520)), -2, android.view.Gravity.TOP | android.view.Gravity.CENTER_HORIZONTAL);
        container.addView(form, formSize);
        LinearLayout branding = new LinearLayout(this); branding.setGravity(android.view.Gravity.CENTER_VERTICAL);
        ImageView mark = new ImageView(this); mark.setImageResource(R.drawable.ic_launcher);
        branding.addView(mark, new LinearLayout.LayoutParams(dp(36), dp(36)));
        TextView brand = text("大疆 4G 助手", 16, INK); brand.setTypeface(null, Typeface.BOLD); brand.setPadding(dp(12), 0, 0, 0);
        branding.addView(brand, new LinearLayout.LayoutParams(0, -2, 1));
        branding.addView(icon(android.R.drawable.ic_menu_help, "连接帮助", this::help)); form.addView(branding);
        TextView heading = text("连接你的电脑", 26, INK); heading.setTypeface(null, Typeface.BOLD); heading.setGravity(android.view.Gravity.CENTER); heading.setPadding(0, dp(40), 0, dp(8)); form.addView(heading);
        TextView mode = text("Windows 远程管理", 13, MUTED); mode.setGravity(android.view.Gravity.CENTER); form.addView(mode);
        status = text("等待配对", 13, MUTED); status.setGravity(android.view.Gravity.CENTER); status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE); form.addView(status);
        scan = button("扫描配对码", () -> new IntentIntegrator(this).setDesiredBarcodeFormats(IntentIntegrator.QR_CODE).setPrompt("扫描电脑助手的配对二维码").setBeepEnabled(false).initiateScan());
        styleButton(scan, ACCENT, Color.WHITE, false); scan.setMinHeight(dp(54));
        scan.setTypeface(null, Typeface.BOLD);
        LinearLayout.LayoutParams scanSize = new LinearLayout.LayoutParams(-1, -2); scanSize.topMargin = dp(20); form.addView(scan, scanSize);
        Button paste = button("粘贴配对链接", this::pastePairing);
        styleButton(paste, Color.WHITE, INK, true); paste.setMinHeight(dp(54));
        LinearLayout.LayoutParams pasteSize = new LinearLayout.LayoutParams(-1, -2); pasteSize.topMargin = dp(12); form.addView(paste, pasteSize);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal); progress.setIndeterminate(true); progress.setVisibility(View.INVISIBLE);
        form.addView(progress, new LinearLayout.LayoutParams(-1, dp(4)));
        View divider = new View(this); divider.setBackgroundColor(Color.rgb(221, 228, 232));
        LinearLayout.LayoutParams lineSize = new LinearLayout.LayoutParams(-1, dp(1)); lineSize.topMargin = dp(20); lineSize.bottomMargin = dp(12); form.addView(divider, lineSize);
        Button manualToggle = button("手动连接", () -> {});
        manualToggle.setGravity(android.view.Gravity.START | android.view.Gravity.CENTER_VERTICAL);
        manualToggle.setPadding(0, dp(12), 0, dp(12));
        android.graphics.drawable.Drawable expand = getDrawable(android.R.drawable.arrow_down_float).mutate();
        expand.setTint(MUTED); expand.setBounds(0, 0, dp(18), dp(18));
        manualToggle.setCompoundDrawablesRelative(null, null, expand, null);
        manualToggle.setOnClickListener(v -> {
            boolean open = manual.getVisibility() != View.VISIBLE;
            manual.setVisibility(open ? View.VISIBLE : View.GONE);
            manualToggle.setText(open ? "收起手动连接" : "手动连接");
            if (android.os.Build.VERSION.SDK_INT >= 30) manualToggle.setStateDescription(open ? "已展开" : "已收起");
        });
        form.addView(manualToggle, new LinearLayout.LayoutParams(-1, -2));
        manual = new LinearLayout(this); manual.setOrientation(LinearLayout.VERTICAL); manual.setVisibility(View.GONE); form.addView(manual);
        manual.addView(text("电脑地址", 13, MUTED));
        address = new EditText(this); address.setHint("http://192.168.1.10:8787"); address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI); address.setSingleLine(true); manual.addView(address);
        manual.addView(text("配对密码", 13, MUTED));
        password = new EditText(this); password.setHint("粘贴电脑提供的密码"); password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD); password.setSingleLine(true); manual.addView(password);
        for (EditText field : new EditText[]{address, password}) {
            field.setTextSize(16); field.setTextColor(INK); field.setPadding(dp(14), dp(12), dp(14), dp(12)); field.setMinHeight(dp(52)); field.setBackground(surface(Color.WHITE));
            if (android.os.Build.VERSION.SDK_INT >= 26) field.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        }
        password.setSaveEnabled(false);
        address.setSaveEnabled(false);
        connect = button("连接电脑", () -> pair(address.getText().toString(), password.getText().toString())); manual.addView(connect, new LinearLayout.LayoutParams(-1, -2));
        password.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_GO);
        password.setOnEditorActionListener((v, action, event) -> { if (action != android.view.inputmethod.EditorInfo.IME_ACTION_GO) return false; pair(address.getText().toString(), password.getText().toString()); return true; });
    }
    private void pastePairing() {
        if (connecting) return;
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        ClipData data = clipboard.getPrimaryClip();
        if (data == null || data.getItemCount() == 0 || data.getItemAt(0).getText() == null) { status.setText("剪贴板没有配对链接。"); return; }
        acceptPairingCode(data.getItemAt(0).getText().toString().trim());
    }
    private void pair(String rawAddress, String rawToken) {
        if (connecting) return;
        final URI base;
        final String secret = rawToken.trim();
        try { base = PairingAddress.normalize(rawAddress); PairingAddress.validateToken(secret); }
        catch (IllegalArgumentException error) { status.setText(error.getMessage()); return; }
        connecting = true; connect.setEnabled(false); scan.setEnabled(false); progress.setVisibility(View.VISIBLE); status.setText("正在验证电脑…");
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
                connecting = false; connect.setEnabled(true); scan.setEnabled(true); progress.setVisibility(View.INVISIBLE);
                if (message != null) { status.setText(message); manual.setVisibility(View.VISIBLE); return; }
                try { vault.save(base.toString(), secret); }
                catch (Exception error) { status.setText("无法安全保存配对，请重试。"); return; }
                host = base; token = secret; password.setText("");
                ((android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(password.getWindowToken(), 0);
                showConsole();
            });
        });
    }
    private void showConsole() {
        shell();
        LinearLayout toolbar = new LinearLayout(this); toolbar.setPadding(dp(12), 0, dp(12), 0); toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);
        LinearLayout labels = new LinearLayout(this); labels.setOrientation(LinearLayout.VERTICAL);
        TextView title = text("大疆 4G 助手", 17, INK); title.setTypeface(null, Typeface.BOLD); title.setPadding(0, dp(4), 0, 0); labels.addView(title);
        TextView subtitle = text(host.getHost(), 12, MUTED); subtitle.setPadding(0, 0, 0, dp(4)); subtitle.setSingleLine(true); subtitle.setEllipsize(android.text.TextUtils.TruncateAt.END); labels.addView(subtitle);
        toolbar.addView(labels, new LinearLayout.LayoutParams(0, -2, 1));
        toolbar.addView(icon(android.R.drawable.ic_popup_sync, "重新连接", this::requestReload));
        ImageButton more = icon(android.R.drawable.ic_menu_more, "更多操作", () -> {});
        more.setOnClickListener(v -> {
            PopupMenu menu = new PopupMenu(this, more);
            menu.getMenu().add("连接帮助"); menu.getMenu().add("忘记这台电脑");
            menu.setOnMenuItemClickListener(item -> {
                if (item.getTitle().equals("连接帮助")) help();
                else new AlertDialog.Builder(this).setTitle("忘记这台电脑？").setMessage("清除手机配对信息，不改变模块设置。").setNegativeButton("取消", null).setPositiveButton("忘记", (d, w) -> forget()).show();
                return true;
            }); menu.show();
        }); toolbar.addView(more); root.addView(toolbar);
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
    private void requestReload() {
        if (loadFailed) { reload(); return; }
        new AlertDialog.Builder(this).setTitle("重新加载页面？").setMessage("未保存的输入可能丢失。已提交的操作不会自动重发。")
            .setNegativeButton("取消", null).setPositiveButton("重新加载", (d, w) -> reload()).show();
    }
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
        WebStorage.getInstance().deleteAllData(); CookieManager.getInstance().removeAllCookies(null); connecting = false; showPairing();
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result == null) { super.onActivityResult(requestCode, resultCode, data); return; }
        if (result.getContents() == null) return;
        acceptPairingCode(result.getContents());
    }
    private void acceptPairingCode(String code) {
        if (connecting) return;
        try {
            Uri qr = Uri.parse(code);
            if (!"dji4g".equals(qr.getScheme()) || !"pair".equals(qr.getHost())) throw new IllegalArgumentException();
            String raw = qr.getQueryParameter("url"), secret = qr.getQueryParameter("token");
            if (raw == null || secret == null) throw new IllegalArgumentException();
            address.setText(raw); password.setText(secret); pair(raw, secret);
        } catch (Exception error) { status.setText("配对码无效，请扫描或复制电脑助手显示的配对链接。"); }
    }
    @Override protected void onDestroy() { generation++; worker.shutdownNow(); if (web != null) web.destroy(); super.onDestroy(); }
}
