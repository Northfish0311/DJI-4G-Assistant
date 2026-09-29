package com.northfish0311.dji4gremote;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Handler;
import android.os.Looper;
import java.net.URI;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;

final class ComputerDiscovery {
    static final String SERVICE_TYPE = "_dji4g._tcp.";
    static final class Computer {
        final String name;
        final String address;
        Computer(String name, String address) { this.name = name; this.address = address; }
    }
    interface Callback { void complete(List<Computer> computers, String error); }
    private final NsdManager manager;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayDeque<NsdServiceInfo> pending = new ArrayDeque<>();
    private final LinkedHashMap<String, Computer> found = new LinkedHashMap<>();
    private NsdManager.DiscoveryListener listener;
    private int generation;
    private boolean resolving;
    private Runnable timeout;

    ComputerDiscovery(Context context) {
        manager = (NsdManager) context.getApplicationContext().getSystemService(Context.NSD_SERVICE);
    }

    void start(Callback callback) {
        stop();
        final int request = generation;
        if (manager == null) { callback.complete(new ArrayList<>(), "当前设备不支持局域网搜索。"); return; }
        listener = new NsdManager.DiscoveryListener() {
            @Override public void onDiscoveryStarted(String type) {}
            @Override public void onServiceFound(NsdServiceInfo service) {
                handler.post(() -> { if (request == generation && listener != null) { pending.add(service); resolveNext(); } });
            }
            @Override public void onServiceLost(NsdServiceInfo service) {
                handler.post(() -> {
                    if (request != generation) return;
                    found.remove(service.getServiceName());
                    pending.removeIf(item -> item.getServiceName().equals(service.getServiceName()));
                });
            }
            @Override public void onDiscoveryStopped(String type) {}
            @Override public void onStartDiscoveryFailed(String type, int code) {
                handler.post(() -> {
                    if (request != generation) return;
                    stop(); callback.complete(new ArrayList<>(), "局域网搜索失败，可扫码或手动连接。");
                });
            }
            @Override public void onStopDiscoveryFailed(String type, int code) {}
        };
        try {
            manager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener);
            timeout = () -> {
                if (request != generation) return;
                List<Computer> result = new ArrayList<>(found.values());
                stop(); callback.complete(result, null);
            };
            handler.postDelayed(timeout, 6000);
        } catch (RuntimeException error) {
            stop(); callback.complete(new ArrayList<>(), "局域网搜索不可用，可扫码或手动连接。");
        }
    }

    private void resolveNext() {
        if (resolving || listener == null || pending.isEmpty()) return;
        final int request = generation;
        NsdServiceInfo service = pending.remove();
        resolving = true;
        try {
            manager.resolveService(service, new NsdManager.ResolveListener() {
                @Override public void onResolveFailed(NsdServiceInfo info, int code) { resolved(request, null); }
                @Override public void onServiceResolved(NsdServiceInfo info) { resolved(request, info); }
            });
        } catch (RuntimeException error) { resolved(request, null); }
    }

    private void resolved(int request, NsdServiceInfo info) {
        handler.post(() -> {
            resolving = false;
            if (request == generation && listener != null && info != null && info.getHost() != null) {
                try {
                    URI endpoint = new URI("http", null, info.getHost().getHostAddress(), info.getPort(), null, null, null);
                    String address = PairingAddress.normalize(endpoint.toString()).toString();
                    found.put(info.getServiceName(), new Computer(info.getServiceName(), address));
                } catch (Exception ignored) { /* Unsupported addresses are not offered for pairing. */ }
            }
            // Legacy Android NSD permits only one outstanding resolve operation.
            resolveNext();
        });
    }

    void stop() {
        generation++;
        if (timeout != null) handler.removeCallbacks(timeout);
        timeout = null;
        NsdManager.DiscoveryListener previous = listener;
        listener = null;
        pending.clear(); found.clear();
        if (previous != null && manager != null) {
            try { manager.stopServiceDiscovery(previous); }
            catch (RuntimeException ignored) { /* Discovery may already have stopped. */ }
        }
    }
}
