package com.northfish0311.dji4gremote;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import java.util.ArrayList;
import java.util.List;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;
import org.json.JSONArray;

final class PairingVault {
    private static final String ALIAS = "dji.remote.pairing";
    private final Context context;
    PairingVault(Context context) { this.context = context.getApplicationContext(); }
    private SecretKey key(boolean create) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(ALIAS)) {
            if (!create) throw new Exception("保存的配对密钥不可用");
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    private void persist(JSONArray items) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key(true));
        String payload = items.toString();
        String data = Base64.encodeToString(cipher.doFinal(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8)), Base64.NO_WRAP);
        String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
        if (!context.getSharedPreferences("pairing", 0).edit().putString("data", data).putString("iv", iv).commit()) throw new Exception("无法保存配对");
    }
    List<JSONObject> list() throws Exception {
        android.content.SharedPreferences prefs = context.getSharedPreferences("pairing", 0);
        if (!prefs.contains("data")) {
            if (prefs.contains("iv")) throw new Exception("保存的配对不完整");
            return new ArrayList<>();
        }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(128, Base64.decode(prefs.getString("iv", ""), Base64.NO_WRAP)));
        return PairingHistory.decode(new String(cipher.doFinal(Base64.decode(prefs.getString("data", ""), Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8));
    }
    void add(String host, String token, String name) throws Exception {
        persist(PairingHistory.prepend(list(), host, token, name));
    }
    void remove(String host) throws Exception {
        JSONArray remaining = PairingHistory.without(list(), host);
        if (remaining.length() == 0) clear();
        else persist(remaining);
    }
    void clear() throws Exception {
        if (!context.getSharedPreferences("pairing", 0).edit().clear().commit()) throw new Exception("无法清除配对");
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) store.deleteEntry(ALIAS);
    }
}
