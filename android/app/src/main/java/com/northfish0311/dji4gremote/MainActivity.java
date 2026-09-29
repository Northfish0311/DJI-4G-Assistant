package com.northfish0311.dji4gremote;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.content.ClipboardManager;
import android.content.ClipData;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler retryHandler = new Handler(Looper.getMainLooper());
    private final ReconnectPolicy retryPolicy = new ReconnectPolicy();
    private final List<View> historyControls = new ArrayList<>();
    private List<JSONObject> savedPairings = new ArrayList<>();
    private boolean vaultUnreadable;
    private boolean started;
    private boolean retryableFailure;
    private long pageLoad;
    private ComputerDiscovery discovery;
    private Button discoverButton;
    private LinearLayout root;
    private TextView status;
    private EditText address, password;
    private Button connect, scan, paste, manualToggle;
    private LinearLayout manual;
    private ProgressBar progress;
    private WebView web;
    private PairingVault vault;
    private URI host;
    private String hostName;
    private String token;
    private int generation;
    private boolean connecting;
    private boolean reconnectScheduled;
    private ConnectivityManager.NetworkCallback networkCallback;
    private static final int INK = Color.rgb(32, 37, 44);
    private static final int MUTED = Color.rgb(116, 123, 134);
    private static final int ACCENT = Color.rgb(23, 100, 237);

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        vault = new PairingVault(this);
        discovery = new ComputerDiscovery(this);
        showPairing();
        if (!savedPairings.isEmpty()) {
            JSONObject saved = savedPairings.get(0);
            address.setText(saved.optString("host"));
            password.setText(saved.optString("token"));
            pair(address.getText().toString(), password.getText().toString());
        }
    }

    @Override protected void onStart() {
        super.onStart();
        started = true;
        startNetworkMonitor();
        if (loadFailed && retryableFailure) scheduleReconnect();
    }

    @Override protected void onStop() {
        started = false;
        cancelReconnect();
        discovery.stop();
        if (discoverButton != null) discoverButton.setEnabled(!connecting);
        stopNetworkMonitor();
        super.onStop();
    }

    private void startNetworkMonitor() {
        if (networkCallback != null) return;
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        if (manager == null) return;
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network network) {
                runOnUiThread(() -> {
                    if (!started || !loadFailed || !retryableFailure || reconnectScheduled || web == null) return;
                    retryPolicy.reset();
                    status.setText("网络已恢复，正在重新连接…");
                    status.setVisibility(View.VISIBLE);
                    scheduleReconnect();
                });
            }
        };
        try {
            manager.registerDefaultNetworkCallback(networkCallback);
        } catch (RuntimeException error) {
            networkCallback = null;
        }
    }

    private void cancelReconnect() {
        retryHandler.removeCallbacksAndMessages(null);
        reconnectScheduled = false;
    }
    private void scheduleReconnect() {
        if (!started || web == null || !loadFailed || !retryableFailure || reconnectScheduled) return;
        long delay = retryPolicy.nextDelay();
        if (delay < 0) { status.setText("多次重连失败，请检查电脑助手和网络，再点击重连。"); return; }
        reconnectScheduled = true;
        retryHandler.postDelayed(() -> {
            reconnectScheduled = false;
            if (started && web != null && loadFailed && retryableFailure) reload();
        }, delay);
    }

    private void stopNetworkMonitor() {
        if (networkCallback == null) return;
        ConnectivityManager manager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        try {
            if (manager != null) manager.unregisterNetworkCallback(networkCallback);
        } catch (RuntimeException ignored) {
        }
        networkCallback = null;
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
        historyControls.clear();
        savedPairings = new ArrayList<>();
        vaultUnreadable = false;
        try { savedPairings = vault.list(); }
        catch (Exception error) { vaultUnreadable = true; }
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
        paste = button("粘贴配对链接", this::pastePairing);
        styleButton(paste, Color.WHITE, INK, true); paste.setMinHeight(dp(54));
        LinearLayout.LayoutParams pasteSize = new LinearLayout.LayoutParams(-1, -2); pasteSize.topMargin = dp(12); form.addView(paste, pasteSize);
        discoverButton = button("搜索局域网电脑", this::startDiscovery);
        styleButton(discoverButton, Color.WHITE, INK, true);
        LinearLayout.LayoutParams discoverSize = new LinearLayout.LayoutParams(-1, -2); discoverSize.topMargin = dp(12);
        form.addView(discoverButton, discoverSize);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal); progress.setIndeterminate(true); progress.setVisibility(View.INVISIBLE);
        form.addView(progress, new LinearLayout.LayoutParams(-1, dp(4)));
        View divider = new View(this); divider.setBackgroundColor(Color.rgb(221, 228, 232));
        LinearLayout.LayoutParams lineSize = new LinearLayout.LayoutParams(-1, dp(1)); lineSize.topMargin = dp(20); lineSize.bottomMargin = dp(12); form.addView(divider, lineSize);
        manualToggle = button("手动连接", () -> {});
        manualToggle.setGravity(android.view.Gravity.START | android.view.Gravity.CENTER_VERTICAL);
        manualToggle.setPadding(0, dp(12), 0, dp(12));
        manualToggle.setOnClickListener(v -> setManualExpanded(manual.getVisibility() != View.VISIBLE));
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
        setManualExpanded(false);
        if (!savedPairings.isEmpty()) {
            form.addView(text("已保存的电脑", 13, MUTED));
            for (JSONObject item : savedPairings) {
                final String savedHost = item.optString("host");
                String name = item.optString("name", "");
                Button history = button(name.isEmpty() ? savedHost : name + "\n" + savedHost, () -> {
                    if (connecting) return;
                    address.setText(savedHost); password.setText(item.optString("token"));
                    pair(savedHost, password.getText().toString());
                });
                styleButton(history, Color.WHITE, INK, true);
                LinearLayout.LayoutParams size = new LinearLayout.LayoutParams(-1, -2); size.topMargin = dp(8);
                form.addView(history, size); historyControls.add(history);
            }
        }
        if (vaultUnreadable || !savedPairings.isEmpty()) {
            Button reset = button(vaultUnreadable ? "重置本机配对" : "清除已保存的电脑", this::resetPairings);
            form.addView(reset, new LinearLayout.LayoutParams(-1, -2)); historyControls.add(reset);
        }
        if (vaultUnreadable) status.setText("保存的配对无法读取，请先重置本机配对，再重新扫码。不会修改电脑或模块。");
    }
    private void resetPairings() {
        if (connecting) return;
        new AlertDialog.Builder(this).setTitle("清除本机配对？")
            .setMessage("仅删除这台手机保存的电脑地址和密码，不修改 Windows 或模块。")
            .setNegativeButton("取消", null).setPositiveButton("清除", (dialog, which) -> {
                generation++;
                try { vault.clear(); showPairing(); }
                catch (Exception error) { status.setText("配对信息未能清除，请重试。没有修改模块。"); }
            }).show();
    }
    private void startDiscovery() {
        if (connecting) return;
        discoverButton.setEnabled(false);
        status.setText("正在搜索局域网电脑…");
        discovery.start((computers, error) -> {
            if (!started || isDestroyed() || web != null || connecting) return;
            discoverButton.setEnabled(true);
            if (error != null) { status.setText(error); return; }
            if (computers.isEmpty()) { status.setText("未发现电脑助手，请确认同一 Wi-Fi；也可以直接扫码连接。"); return; }
            String[] labels = new String[computers.size()];
            for (int i = 0; i < labels.length; i++) labels[i] = computers.get(i).name + "\n" + computers.get(i).address;
            status.setText("发现 " + computers.size() + " 台电脑");
            new AlertDialog.Builder(this).setTitle("选择电脑助手").setItems(labels, (dialog, which) -> {
                ComputerDiscovery.Computer selected = computers.get(which);
                address.setText(selected.address); password.setText(""); setManualExpanded(true);
                status.setText("已填入地址，请粘贴这台电脑提供的配对密码。搜索不会自动授权。");
            }).setNegativeButton("取消", null).show();
        });
    }
    private void setManualExpanded(boolean open) {
        manual.setVisibility(open ? View.VISIBLE : View.GONE);
        manualToggle.setText(open ? "收起手动连接" : "手动连接");
        android.graphics.drawable.Drawable arrow = getDrawable(open ? android.R.drawable.arrow_up_float : android.R.drawable.arrow_down_float).mutate();
        arrow.setTint(MUTED); arrow.setBounds(0, 0, dp(18), dp(18));
        manualToggle.setCompoundDrawablesRelative(null, null, arrow, null);
        if (android.os.Build.VERSION.SDK_INT >= 30) manualToggle.setStateDescription(open ? "已展开" : "已收起");
    }
    private void setConnecting(boolean busy) {
        connecting = busy;
        for (View control : new View[]{connect, scan, paste, address, password}) control.setEnabled(!busy);
        if (discoverButton != null) discoverButton.setEnabled(!busy);
        for (View control : historyControls) control.setEnabled(!busy);
        progress.setVisibility(busy ? View.VISIBLE : View.INVISIBLE);
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
        if (vaultUnreadable) { status.setText("请先重置无法读取的本机配对，再重新扫码。"); return; }
        final URI base;
        final String secret = rawToken.trim();
        try { base = PairingAddress.normalize(rawAddress); PairingAddress.validateToken(secret); }
        catch (IllegalArgumentException error) { status.setText(error.getMessage()); setManualExpanded(true); return; }
        discovery.stop();
        setConnecting(true); status.setText("正在验证电脑…");
        final int request = ++generation;
        worker.execute(() -> {
            HttpURLConnection connection = null;
            String failure = null;
            String verifiedName = base.getHost();
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
                JSONObject payload = new JSONObject(output.toString("UTF-8"));
                if (!payload.optBoolean("ok")) throw new Exception("电脑未接受配对。");
                String suppliedName = payload.optString("name", "").trim();
                if (!suppliedName.isEmpty()) verifiedName = suppliedName;
            } catch (Exception error) {
                failure = error instanceof java.io.IOException ? "无法连接电脑。请检查同一 Wi-Fi、电脑助手和防火墙，然后重试。" : error.getMessage();
            } finally { if (connection != null) connection.disconnect(); }
            final String message = failure;
            final String computerName = verifiedName;
            runOnUiThread(() -> {
                if (isDestroyed() || request != generation) return;
                setConnecting(false);
                if (message != null) { status.setText(message); setManualExpanded(true); return; }
                try { vault.add(base.toString(), secret, computerName); }
                catch (Exception error) { status.setText("无法安全保存配对，请重试。"); setManualExpanded(true); return; }
                host = base; hostName = computerName; token = secret; password.setText("");
                ((android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(password.getWindowToken(), 0);
                showConsole();
            });
        });
    }
    private void showConsole() {
        retryPolicy.reset(); retryableFailure = true;
        shell();
        LinearLayout toolbar = new LinearLayout(this); toolbar.setPadding(dp(12), 0, dp(12), 0); toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);
        LinearLayout labels = new LinearLayout(this); labels.setOrientation(LinearLayout.VERTICAL);
        TextView title = text("大疆 4G 助手", 17, INK); title.setTypeface(null, Typeface.BOLD); title.setPadding(0, dp(4), 0, 0); labels.addView(title);
        String identity = hostName == null || hostName.equals(host.getHost()) ? host.getHost() : hostName + " · " + host.getHost();
        TextView subtitle = text(identity, 12, MUTED); subtitle.setPadding(0, 0, 0, dp(4)); subtitle.setSingleLine(true); subtitle.setEllipsize(android.text.TextUtils.TruncateAt.END); labels.addView(subtitle);
        toolbar.addView(labels, new LinearLayout.LayoutParams(0, -2, 1));
        toolbar.addView(icon(android.R.drawable.ic_popup_sync, "重新连接", this::requestReload));
        ImageButton more = icon(android.R.drawable.ic_menu_more, "更多操作", () -> {});
        more.setOnClickListener(v -> {
            PopupMenu menu = new PopupMenu(this, more);
            menu.getMenu().add("连接帮助"); menu.getMenu().add("更换电脑"); menu.getMenu().add("忘记这台电脑");
            menu.setOnMenuItemClickListener(item -> {
                if (item.getTitle().equals("连接帮助")) help();
                else if (item.getTitle().equals("更换电脑")) new AlertDialog.Builder(this).setTitle("更换电脑？")
                    .setMessage("未保存的输入会丢失。保留当前电脑的配对，不会重发已提交的操作。")
                    .setNegativeButton("取消", null).setPositiveButton("更换", (d, w) -> disconnectConsole()).show();
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
            @Override public void onPageFinished(WebView view, String url) {
                if (view == web && !loadFailed) { cancelReconnect(); retryPolicy.reset(); status.setVisibility(View.GONE); }
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (view == web && request.isForMainFrame()) failed("连接中断，正在尝试重连。请保持电脑助手运行。", true);
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (view != web || !request.isForMainFrame()) return;
                int code = response.getStatusCode();
                failed(code == 401 || code == 403 ? "配对密码已失效，请忘记这台电脑，再重新扫码。" : "电脑返回错误（HTTP " + code + "）。", code >= 500);
            }
        });
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1)); reload();
    }
    private boolean loadFailed;
    private void requestReload() {
        if (loadFailed) { retryPolicy.reset(); retryableFailure = true; reload(); return; }
        new AlertDialog.Builder(this).setTitle("重新加载页面？").setMessage("未保存的输入可能丢失。已提交的操作不会自动重发。")
            .setNegativeButton("取消", null).setPositiveButton("重新加载", (d, w) -> { retryPolicy.reset(); retryableFailure = true; reload(); }).show();
    }
    private void failed(String message, boolean retryable) {
        cancelReconnect(); loadFailed = true; retryableFailure = retryable;
        status.setText(message); status.setVisibility(View.VISIBLE);
        if (retryable) scheduleReconnect();
    }
    private void reload() {
        if (web == null || host == null) return;
        cancelReconnect(); loadFailed = false; status.setText("正在连接…"); status.setVisibility(View.VISIBLE);
        // A repeated URL with a fragment can become a same-document navigation instead of a new GET.
        Uri url = Uri.parse(host.toString()).buildUpon().appendQueryParameter("token", token).appendQueryParameter("native", "android")
            .appendQueryParameter("nativeLoad", Long.toString(++pageLoad)).fragment("overview").build();
        web.loadUrl(url.toString());
    }
    private void forget() {
        try { if (host != null) vault.remove(host.toString()); }
        catch (Exception error) { status.setText("配对未能删除，请重试。当前配对仍保留。"); status.setVisibility(View.VISIBLE); return; }
        disconnectConsole();
    }
    private void disconnectConsole() {
        generation++; cancelReconnect(); discovery.stop();
        token = null; host = null; hostName = null; loadFailed = false; retryableFailure = false;
        if (web != null) { web.clearCache(true); web.clearHistory(); }
        destroyConsole();
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
    private void destroyConsole() {
        cancelReconnect();
        if (web == null) return;
        web.stopLoading();
        web.setWebViewClient(new WebViewClient()); web.setWebChromeClient(null);
        if (web.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup) web.getParent()).removeView(web);
        web.destroy(); web = null;
    }
    @Override protected void onDestroy() { generation++; cancelReconnect(); stopNetworkMonitor(); discovery.stop(); worker.shutdownNow(); destroyConsole(); super.onDestroy(); }
}
