package com.northfish0311.dji4gremote;

final class ReconnectPolicy {
    private static final long[] DELAYS = {1000, 2000, 4000};
    private int attempts;

    long nextDelay() {
        return attempts < DELAYS.length ? DELAYS[attempts++] : -1;
    }

    void reset() { attempts = 0; }
}
