"use strict";

function parseVoiceNetwork(text) {
  const value = String(text || "");
  const ims = value.match(/\+QCFG:\s*"ims"\s*,\s*([012])\s*,\s*([01])/i);
  const registration = name => {
    const match = value.match(new RegExp("\\+" + name + ":\\s*\\d+\\s*,\\s*(\\d+)", "i"));
    return match ? Number(match[1]) : null;
  };
  const contexts = [...value.matchAll(/\+CGDCONT:\s*(\d+)\s*,\s*"[^"]*"\s*,\s*"ims"/gi)].map(match => Number(match[1]));
  const active = [...value.matchAll(/\+CGACT:\s*(\d+)\s*,\s*1\b/g)].map(match => Number(match[1]));
  const cause = value.match(/\+CEER:\s*([^\r\n]+)/i)?.[1]?.trim() || "";
  const imsMode = ims ? Number(ims[1]) : null;
  const volteEnabled = ims ? ims[2] === "1" : null;
  const lteRegistration = registration("CEREG");
  const csRegistration = registration("CREG");
  const lteRegistered = lteRegistration === null ? null : [1, 5].includes(lteRegistration);
  const imsBearerActive = contexts.length ? contexts.some(id => active.includes(id)) : null;
  // QCFG reports configuration/capability, not proof of IMS registration.
  const diagnosis = imsMode === 2 ? "IMS_DISABLED"
    : lteRegistered === false ? "LTE_NOT_REGISTERED"
    : volteEnabled === false ? "VOLTE_NOT_READY"
    : imsBearerActive === false ? "IMS_BEARER_INACTIVE" : "VOICE_NETWORK_UNVERIFIED";
  return { imsMode, volteEnabled, lteRegistration, csRegistration, lteRegistered, imsBearerActive,
    lastFailure: /^0\s*,\s*-1$/.test(cause) ? "" : cause, diagnosis };
}

module.exports = { parseVoiceNetwork };
