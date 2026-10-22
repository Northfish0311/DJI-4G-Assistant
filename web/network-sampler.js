function readItems(result) {
  if (!result?.ok) return null;
  try {
    const value = JSON.parse(String(result.stdout || "[]"));
    const items = Array.isArray(value) ? value : [value];
    return items.every(item => item && typeof item === "object" && !Array.isArray(item)) ? items : null;
  } catch { return null; }
}

function adapterId(item) {
  return String(item.interfaceId || "").replace(/[{}]/g, "").toLowerCase();
}

function mergeFastSample(details, sample) {
  const previous = readItems(details), current = readItems(sample);
  if (!previous || !current || previous.length !== current.length) return null;
  const byId = new Map(current.map(item => [adapterId(item), item]));
  if (byId.size !== current.length || byId.has("")) return null;
  const merged = [];
  for (const item of previous) {
    const fresh = byId.get(adapterId(item));
    // Any topology change requires a fresh driver/address query, not cached metadata.
    if (!fresh || fresh.description !== item.description || fresh.status !== item.status
      || !Array.isArray(fresh.ipv4Addresses) || !fresh.ipv4Addresses.includes(item.ipv4 || "")) return null;
    merged.push({...item, receivedBytes: fresh.receivedBytes, sentBytes: fresh.sentBytes,
      statisticsReliable: fresh.statisticsReliable, performanceCounters: fresh.performanceCounters,
      sampledAt: fresh.sampledAt});
  }
  return {...sample, stdout: JSON.stringify(merged)};
}

function createNetworkSampler({readFull, readFast, now = Date.now, refreshMs = 60000}) {
  let details = null, checkedAt = 0, pending = null, generation = 0;
  async function full() {
    const startedGeneration = generation;
    const result = await readFull();
    if (generation === startedGeneration) {
      details = readItems(result) ? result : null;
      checkedAt = now();
    }
    return result;
  }
  return {
    sample({refreshDetails = false} = {}) {
      if (refreshDetails) {
        if (pending) return pending.then(() => this.sample({refreshDetails: true}));
        generation++;
        details = null;
      }
      if (pending) return pending;
      pending = (async () => {
        if (!details || now() - checkedAt >= refreshMs) return full();
        const fast = await readFast();
        if (!readItems(fast)) return full();
        return mergeFastSample(details, fast) || full();
      })().finally(() => { pending = null; });
      return pending;
    },
    invalidate() { generation++; details = null; },
  };
}

module.exports = {createNetworkSampler, mergeFastSample};
