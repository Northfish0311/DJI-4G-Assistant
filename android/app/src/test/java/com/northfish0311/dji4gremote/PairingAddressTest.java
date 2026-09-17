package com.northfish0311.dji4gremote;
import org.junit.Test;
import static org.junit.Assert.*;
public class PairingAddressTest {
    @Test public void acceptsPrivateAddresses() {
        for (String host : new String[]{"192.168.1.2", "10.0.0.2", "172.16.0.2", "assistant.local"}) assertEquals(host, PairingAddress.normalize("http://" + host + ":8787/path?token=old").getHost());
    }
    @Test public void rejectsUnsafeAddresses() {
        for (String host : new String[]{"127.0.0.1", "localhost", "example.com", "8.8.8.8", "192.168.1.300", "010.0.0.1", "user:pass@192.168.1.2"}) assertThrows(IllegalArgumentException.class, () -> PairingAddress.normalize("http://" + host));
    }
    @Test public void locksExactOrigin() {
        java.net.URI base = PairingAddress.normalize("http://192.168.1.2:8787");
        assertTrue(PairingAddress.sameOrigin(base, "http://192.168.1.2:8787/api/status"));
        assertFalse(PairingAddress.sameOrigin(base, "https://192.168.1.2:8787"));
        assertFalse(PairingAddress.sameOrigin(base, "http://192.168.1.2:80"));
        assertFalse(PairingAddress.sameOrigin(base, "file:///sdcard/test"));
    }
    @Test public void rejectsInvalidToken() { assertThrows(IllegalArgumentException.class, () -> PairingAddress.validateToken("short")); }
}
