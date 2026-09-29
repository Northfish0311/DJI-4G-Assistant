package com.northfish0311.dji4gremote;

import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public class PairingHistoryTest {
    private static final String TOKEN = "test-token-abcdefghijklmnopqrstuvwxyz-123456";
    private List<JSONObject> history(String... hosts) throws Exception {
        JSONArray data = new JSONArray();
        for (String host : hosts) data.put(new JSONObject().put("host", host).put("token", TOKEN).put("name", "test"));
        return PairingHistory.decode(data.toString());
    }
    @Test public void addingSecondAndThirdComputersPreservesHistory() throws Exception {
        List<JSONObject> original = history("http://192.168.1.2:8787");
        JSONArray second = PairingHistory.prepend(original, "http://192.168.1.3:8787", TOKEN, "second");
        JSONArray third = PairingHistory.prepend(PairingHistory.decode(second.toString()), "http://192.168.1.4:8787", TOKEN, "third");
        assertEquals(3, third.length());
        assertEquals("http://192.168.1.4:8787", third.getJSONObject(0).getString("host"));
        assertEquals("http://192.168.1.2:8787", third.getJSONObject(2).getString("host"));
        assertEquals(1, original.size());
    }
    @Test public void reconnectMovesOnlyMatchingComputerToFront() throws Exception {
        List<JSONObject> original = history("http://192.168.1.2", "http://192.168.1.3", "http://192.168.1.4");
        JSONArray updated = PairingHistory.prepend(original, "http://192.168.1.3/", TOKEN + "new", "renamed");
        assertEquals(3, updated.length());
        assertEquals("renamed", updated.getJSONObject(0).getString("name"));
        assertEquals(TOKEN + "new", updated.getJSONObject(0).getString("token"));
        assertEquals("http://192.168.1.2", updated.getJSONObject(1).getString("host"));
        assertEquals("http://192.168.1.4", updated.getJSONObject(2).getString("host"));
    }
    @Test public void acceptsLegacySingleComputerWithoutDroppingIt() throws Exception {
        JSONObject legacy = new JSONObject().put("host", "http://192.168.1.2").put("token", TOKEN);
        List<JSONObject> items = PairingHistory.decode(legacy.toString());
        assertEquals(1, items.size());
        assertEquals(2, PairingHistory.prepend(items, "http://192.168.1.3", TOKEN, "new").length());
    }
    @Test public void corruptionIsNotReportedAsEmptyHistory() {
        for (String bad : new String[]{"not-json", "null", "[null]", "{}", "[{\"host\":\"http://192.168.1.2\",\"token\":\"short\"}]"}) {
            assertThrows(Exception.class, () -> PairingHistory.decode(bad));
        }
    }
    @Test public void removesOnlySelectedComputer() throws Exception {
        List<JSONObject> items = history("http://192.168.1.2", "http://192.168.1.3");
        JSONArray remaining = PairingHistory.without(items, "http://192.168.1.2");
        assertEquals(1, remaining.length());
        assertEquals("http://192.168.1.3", remaining.getJSONObject(0).getString("host"));
        assertEquals(2, PairingHistory.without(items, "http://192.168.1.9").length());
    }
}
