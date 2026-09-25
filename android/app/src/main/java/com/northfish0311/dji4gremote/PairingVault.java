package com.northfish0311.dji4gremote;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

final class PairingVault {
    private static final String ALIAS = "dji.remote.pairing";
    private final Context context;
    PairingVault(Context context) { this.context = context; }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    void save(String host, String token, String name) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        String payload = new JSONObject().put("host", host).put("token", token).put("name", name).toString();
        String data = Base64.encodeToString(cipher.doFinal(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8)), Base64.NO_WRAP);
        String iv = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP);
        if (!context.getSharedPreferences("pairing", 0).edit().putString("data", data).putString("iv", iv).commit()) throw new Exception("无法保存配对");
    }
    JSONObject load() throws Exception {
        android.content.SharedPreferences prefs = context.getSharedPreferences("pairing", 0);
        if (!prefs.contains("data")) return null;
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(prefs.getString("iv", ""), Base64.NO_WRAP)));
        return new JSONObject(new String(cipher.doFinal(Base64.decode(prefs.getString("data", ""), Base64.NO_WRAP)), java.nio.charset.StandardCharsets.UTF_8));
    }
    void clear() { context.getSharedPreferences("pairing", 0).edit().clear().commit(); }
}
