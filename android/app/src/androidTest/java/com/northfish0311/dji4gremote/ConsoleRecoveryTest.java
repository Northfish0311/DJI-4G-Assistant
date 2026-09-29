package com.northfish0311.dji4gremote;

import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class ConsoleRecoveryTest {
    @Before public void clearPairings() throws Exception {
        new PairingVault(ApplicationProvider.getApplicationContext()).clear();
    }
    private void console(ActivityScenario<MainActivity> scenario, Fixture fixture) {
        scenario.onActivity(activity -> {
            try {
                for (String field : new String[]{"host", "hostName", "token"}) {
                    Field member = MainActivity.class.getDeclaredField(field); member.setAccessible(true);
                    member.set(activity, field.equals("host") ? URI.create(fixture.origin()) : "emulator-fixture-abcdefghijklmnopqrstuvwxyz");
                }
                Method show = MainActivity.class.getDeclaredMethod("showConsole"); show.setAccessible(true); show.invoke(activity);
            } catch (Exception error) { throw new AssertionError(error); }
        });
    }
    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        AtomicReference<String> result = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        scenario.onActivity(activity -> {
            try {
                Field member = MainActivity.class.getDeclaredField("web"); member.setAccessible(true);
                ((WebView) member.get(activity)).evaluateJavascript(script, value -> { result.set(value); done.countDown(); });
            } catch (Exception error) { throw new AssertionError(error); }
        });
        assertTrue("WebView callback timed out", done.await(5, TimeUnit.SECONDS));
        return result.get();
    }
    private void waitFor(BooleanSupplier condition, long timeout) throws Exception {
        long deadline = System.currentTimeMillis() + timeout;
        while (!condition.getAsBoolean() && System.currentTimeMillis() < deadline) Thread.sleep(100);
        assertTrue("Expected WebView request was not observed", condition.getAsBoolean());
    }
    @Test public void returningFromBackgroundPreservesDraft() throws Exception {
        try (Fixture fixture = new Fixture(200); ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            console(scenario, fixture);
            waitFor(() -> fixture.requests.get() >= 1, 10000);
            String value = "null";
            for (int i = 0; i < 30 && "null".equals(value); i++) {
                value = evaluate(scenario, "document.getElementById('draft') ? (document.getElementById('draft').value='keep this draft') : null");
                if ("null".equals(value)) Thread.sleep(100);
            }
            assertEquals("\"keep this draft\"", value);
            int before = fixture.requests.get();
            scenario.moveToState(Lifecycle.State.CREATED);
            scenario.moveToState(Lifecycle.State.RESUMED);
            Thread.sleep(1000);
            assertEquals("\"keep this draft\"", evaluate(scenario, "document.getElementById('draft').value"));
            assertEquals(before, fixture.requests.get());
        }
    }
    @Test public void retryWaitsForAsynchronousFailureAndStopsAfterThree() throws Exception {
        try (Fixture fixture = new Fixture(503); ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            console(scenario, fixture);
            waitFor(() -> fixture.requests.get() >= 4, 20000);
            Thread.sleep(2500);
            assertEquals(4, fixture.requests.get());
        }
    }
    @Test public void authFailuresAreNotAutomaticallyRetried() throws Exception {
        try (Fixture fixture = new Fixture(401); ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            console(scenario, fixture);
            waitFor(() -> fixture.requests.get() >= 1, 10000);
            Thread.sleep(2500);
            assertEquals(1, fixture.requests.get());
        }
    }
    private static final class Fixture implements AutoCloseable {
        final AtomicInteger requests = new AtomicInteger();
        final ServerSocket server;
        final Thread thread;
        final int status;
        volatile boolean closed;
        Fixture(int status) throws Exception {
            this.status = status;
            server = new ServerSocket(0, 10, InetAddress.getByName("127.0.0.1"));
            thread = new Thread(() -> {
                while (!closed) {
                    try (Socket socket = server.accept()) {
                        socket.setSoTimeout(5000);
                        BufferedReader input = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
                        String request = input.readLine();
                        String line;
                        while ((line = input.readLine()) != null && !line.isEmpty()) {}
                        boolean main = request != null && (request.startsWith("GET /?") || request.startsWith("GET / HTTP"));
                        if (main) requests.incrementAndGet();
                        int code = main ? this.status : 204;
                        byte[] body = (main ? "<!doctype html><html><head><title>fixture</title></head><body><input id='draft'></body></html>" : "").getBytes(StandardCharsets.UTF_8);
                        String header = "HTTP/1.1 " + code + " " + (code == 200 ? "OK" : code == 503 ? "Service Unavailable" : code == 401 ? "Unauthorized" : "No Content")
                            + "\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nConnection: close\r\nContent-Length: " + body.length + "\r\n\r\n";
                        socket.getOutputStream().write(header.getBytes(StandardCharsets.UTF_8)); socket.getOutputStream().write(body);
                    } catch (Exception error) { if (!closed) throw new RuntimeException(error); }
                }
            }, "local-webview-fixture");
            thread.setDaemon(true); thread.start();
        }
        String origin() { return "http://127.0.0.1:" + server.getLocalPort(); }
        @Override public void close() throws Exception { closed = true; server.close(); thread.join(5000); }
    }
}
