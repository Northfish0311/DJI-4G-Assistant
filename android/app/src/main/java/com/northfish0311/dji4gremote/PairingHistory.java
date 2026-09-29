package com.northfish0311.dji4gremote;

import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class PairingHistory {
    private PairingHistory() {}

    static List<JSONObject> decode(String json) throws JSONException {
        JSONArray items = json.trim().startsWith("{")
            ? new JSONArray().put(new JSONObject(json)) : new JSONArray(json);
        List<JSONObject> result = new ArrayList<>();
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.getJSONObject(i);
            String host = PairingAddress.normalize(item.getString("host")).toString();
            String token = item.getString("token");
            PairingAddress.validateToken(token);
            result.add(new JSONObject().put("host", host).put("token", token).put("name", item.optString("name", "")));
        }
        return result;
    }

    static JSONArray prepend(List<JSONObject> existing, String host, String token, String name) throws JSONException {
        host = PairingAddress.normalize(host).toString();
        PairingAddress.validateToken(token);
        JSONArray updated = new JSONArray();
        updated.put(new JSONObject().put("host", host).put("token", token).put("name", name));
        for (JSONObject item : existing) {
            if (!host.equals(item.getString("host"))) updated.put(item);
        }
        return updated;
    }

    static JSONArray without(List<JSONObject> existing, String host) throws JSONException {
        JSONArray updated = new JSONArray();
        for (JSONObject item : existing) {
            if (!host.equals(item.getString("host"))) updated.put(item);
        }
        return updated;
    }
}
