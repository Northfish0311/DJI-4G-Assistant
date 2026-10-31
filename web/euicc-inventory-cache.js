function createEuiccInventoryCache({ readIdentity, scan, remember, now = Date.now, ttlMs = 20000 }) {
  let cached = null;
  let pending = null;
  let generation = 0;
  const changed = () => Object.assign(new Error("The card or profile state changed while reading. Refresh the card list."), { code: "EUICC_INVENTORY_CHANGED" });
  const invalidate = () => { generation += 1; cached = null; pending = null; };

  return {
    invalidate,
    read(context, { force = false } = {}) {
      const key = JSON.stringify([context.lpac, String(context.portName).toUpperCase()]);
      if ((pending && pending.key !== key) || (force && !pending?.forced)) invalidate();
      if (pending) return pending.promise;
      const request = { key, forced: force, generation, promise: null };
      const assertCurrent = () => { if (request.generation !== generation) throw changed(); };
      request.promise = (async () => {
        const before = await readIdentity(context);
        assertCurrent();
        if (!force && before && cached?.key === key && cached.identity === before
          && now() - cached.at < ttlMs) return cached.value;
        cached = null;
        const result = await scan(context);
        assertCurrent();
        const after = await readIdentity(context);
        assertCurrent();
        if (before !== after) { invalidate(); throw changed(); }
        // An unreadable ICCID must not prevent managing an eUICC with no enabled profile.
        // Such scans remain uncached; mutations still verify the target EID separately.
        if (result.eids?.length) remember(context, result);
        if (before && result.ok && result.profilesComplete && result.eids?.length) {
          cached = { key, identity: before, at: now(), value: result };
        }
        return result;
      })().catch((error) => {
        if (request.generation === generation) cached = null;
        throw error;
      }).finally(() => { if (pending === request) pending = null; });
      pending = request;
      return request.promise;
    },
  };
}

module.exports = { createEuiccInventoryCache };
