function logEvent(event, correlation_id, details = {}) {
  const time = new Date().toISOString();
  console.log(`[${time}] [${correlation_id}] ${event}`, details);
}

module.exports = { logEvent };
