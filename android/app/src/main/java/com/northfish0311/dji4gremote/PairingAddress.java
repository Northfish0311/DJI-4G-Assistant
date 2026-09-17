package com.northfish0311.dji4gremote;

import java.net.URI;

public final class PairingAddress {
    private PairingAddress() {}
    public static URI normalize(String raw) {
        try {
            URI uri = new URI(raw.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (!("http".equals(scheme) || "https".equals(scheme)) || uri.getRawUserInfo() != null || host == null || !isLocal(host)) throw new IllegalArgumentException();
            if (uri.getPort() == 0 || uri.getPort() > 65535) throw new IllegalArgumentException();
            return new URI(scheme, null, host, uri.getPort(), "", null, null);
        } catch (Exception error) { throw new IllegalArgumentException("请输入电脑的局域网地址，例如 http://192.168.1.10:8787；不要填写 127.0.0.1。"); }
    }
    static boolean isLocal(String host) {
        if (host.toLowerCase(java.util.Locale.ROOT).matches("[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.local")) return true;
        String[] parts = host.split("\\.", -1);
        if (parts.length != 4) return false;
        int[] n = new int[4];
        for (int i = 0; i < 4; i++) {
            if (!parts[i].matches("0|[1-9][0-9]{0,2}")) return false;
            n[i] = Integer.parseInt(parts[i]);
            if (n[i] > 255) return false;
        }
        return n[0] == 10 || (n[0] == 172 && n[1] >= 16 && n[1] <= 31) || (n[0] == 192 && n[1] == 168) || (n[0] == 169 && n[1] == 254);
    }
    public static boolean sameOrigin(URI base, String value) {
        try {
            URI other = new URI(value);
            return other.getRawUserInfo() == null && base.getScheme().equals(other.getScheme()) && base.getHost().equalsIgnoreCase(other.getHost()) && port(base) == port(other);
        } catch (Exception error) { return false; }
    }
    private static int port(URI uri) { return uri.getPort() >= 0 ? uri.getPort() : ("https".equals(uri.getScheme()) ? 443 : 80); }
    public static void validateToken(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{32,128}")) throw new IllegalArgumentException("配对密码无效，请重新扫描电脑上的二维码。");
    }
}
