function consoleAccess(host, port, interfaces) {
  const loopback = ["127.0.0.1", "::1", "localhost"].includes(host);
  const wildcard = host === "0.0.0.0" || host === "::";
  const localHost = loopback ? (host === "::1" ? "[::1]" : "127.0.0.1") : wildcard ? "127.0.0.1" : host;
  const localUrl = `http://${localHost}:${port}`;
  const candidates = [];
  if (!loopback) {
    for (const [name, entries] of Object.entries(interfaces)) {
      if (/vEthernet|VMware|VirtualBox|WSL|Docker|Tailscale|ZeroTier|VPN|\bTAP\b|\bTUN\b|Loopback|Bluetooth/i.test(name)) continue;
      for (const item of entries || []) {
        if (item.family !== "IPv4" || item.internal || (!wildcard && item.address !== host)) continue;
        if (!/^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(item.address)) continue;
        const wifi = /Wi-?Fi|WLAN|Wireless|无线/i.test(name);
        if (!wifi && /^192\.168\.225\./.test(item.address)) continue;
        candidates.push({address: item.address, score: wifi ? 1 : 0});
      }
    }
  }
  const urls = [...new Set(candidates.sort((a, b) => b.score - a.score).map(item => `http://${item.address}:${port}`))];
  return {localUrl, urls, primaryUrl: urls[0] || localUrl, accessMode: loopback ? "local" : "lan",
    pairingAvailable: urls.length > 0, pairingReason: loopback ? "LOCAL_ONLY" : urls.length ? "" : "NO_LAN_ADDRESS"};
}

module.exports = {consoleAccess};
