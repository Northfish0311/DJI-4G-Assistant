package com.northfish0311.dji4gremote;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PairingVaultTest {
    private static final String TOKEN = "emulator-only-fixture-token-abcdefghijklmnopqrstuvwxyz";
    private PairingVault vault;
    private SharedPreferences prefs;
    @Before public void setup() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        vault = new PairingVault(context);
        prefs = context.getSharedPreferences("pairing", 0);
        vault.clear();
    }
    @After public void cleanup() throws Exception { vault.clear(); }
    @Test public void encryptedRoundTripPreservesThreeComputers() throws Exception {
        vault.add("http://192.168.1.2", TOKEN, "first");
        vault.add("http://192.168.1.3", TOKEN, "second");
        vault.add("http://192.168.1.4", TOKEN, "third");
        assertEquals(3, vault.list().size());
        assertEquals("third", vault.list().get(0).getString("name"));
        assertFalse(prefs.getString("data", "").contains(TOKEN));
        vault.remove("http://192.168.1.3");
        assertEquals(2, vault.list().size());
        assertEquals("first", vault.list().get(1).getString("name"));
    }
    @Test public void corruptedCiphertextCanBeExplicitlyReset() throws Exception {
        vault.add("http://192.168.1.2", TOKEN, "first");
        assertTrue(prefs.edit().putString("data", "invalid-ciphertext").commit());
        assertThrows(Exception.class, () -> vault.list());
        assertThrows(Exception.class, () -> vault.add("http://192.168.1.3", TOKEN, "second"));
        assertEquals("invalid-ciphertext", prefs.getString("data", ""));
        vault.clear();
        vault.add("http://192.168.1.3", TOKEN, "second");
        assertEquals(1, vault.list().size());
    }
    @Test public void missingKeyDoesNotSilentlyReplaceStoredPairing() throws Exception {
        vault.add("http://192.168.1.2", TOKEN, "first");
        KeyStore keys = KeyStore.getInstance("AndroidKeyStore"); keys.load(null);
        keys.deleteEntry("dji.remote.pairing");
        assertThrows(Exception.class, () -> vault.list());
        assertFalse(keys.containsAlias("dji.remote.pairing"));
        vault.clear();
        vault.add("http://192.168.1.3", TOKEN, "second");
        assertEquals(1, vault.list().size());
    }
    @Test public void migratesEncryptedLegacyObjectWhenNextSaved() throws Exception {
        vault.add("http://192.168.1.2", TOKEN, "first");
        KeyStore keys = KeyStore.getInstance("AndroidKeyStore"); keys.load(null);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, (SecretKey) keys.getKey("dji.remote.pairing", null));
        String legacy = new JSONObject().put("host", "http://192.168.1.2").put("token", TOKEN).put("name", "legacy").toString();
        assertTrue(prefs.edit().putString("data", Base64.encodeToString(cipher.doFinal(legacy.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP))
            .putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).commit());
        assertEquals("legacy", vault.list().get(0).getString("name"));
        vault.add("http://192.168.1.3", TOKEN, "new");
        assertEquals(2, vault.list().size());
        assertEquals("legacy", vault.list().get(1).getString("name"));
    }
}
