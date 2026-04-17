function sanitizeTimestamp(value) {
  const t = new Date(value || Date.now()).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

function pruneWindow(list, now, windowMs) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const minTs = now - windowMs;
  return list.filter((entry) => entry >= minTs);
}

function recordInWindow(map, key, timestamp, windowMs, hardCap = 500) {
  const now = sanitizeTimestamp(timestamp);
  const existing = map.get(key) || [];
  const windowed = pruneWindow(existing, now, windowMs);
  windowed.push(now);

  if (windowed.length > hardCap) {
    windowed.splice(0, windowed.length - hardCap);
  }

  map.set(key, windowed);
  return windowed;
}

module.exports = {
  sanitizeTimestamp,
  pruneWindow,
  recordInWindow,
};
