class TTLCache {
  constructor(ttlMs = 300000) {
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }
  set(key, value) {
    const expires = Date.now() + this.ttlMs;
    this.cache.set(key, { value, expires });
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }
}

module.exports = TTLCache;
