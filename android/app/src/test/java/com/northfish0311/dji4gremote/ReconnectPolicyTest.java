package com.northfish0311.dji4gremote;

import org.junit.Test;
import static org.junit.Assert.*;

public class ReconnectPolicyTest {
    @Test public void stopsAfterThreeDelayedAttempts() {
        ReconnectPolicy policy = new ReconnectPolicy();
        assertEquals(1000, policy.nextDelay());
        assertEquals(2000, policy.nextDelay());
        assertEquals(4000, policy.nextDelay());
        assertEquals(-1, policy.nextDelay());
        assertEquals(-1, policy.nextDelay());
    }
    @Test public void explicitResetStartsNewCycle() {
        ReconnectPolicy policy = new ReconnectPolicy();
        policy.nextDelay(); policy.nextDelay(); policy.nextDelay();
        policy.reset();
        assertEquals(1000, policy.nextDelay());
    }
}
