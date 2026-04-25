const { v4: uuidv4 } = require('uuid');

function validateFieldNote(req, res, next) {
  req.correlation_id = uuidv4();
  const { observation, region, crop_type } = req.body;
  if (!observation || typeof observation !== 'string' || observation.length > 500) {
    return res.status(400).json({ error: 'Invalid observation', correlation_id: req.correlation_id });
  }
  if (!region || !crop_type) {
    return res.status(400).json({ error: 'region and crop_type required', correlation_id: req.correlation_id });
  }
  next();
}

function validateRecommendation(req, res, next) {
  req.correlation_id = uuidv4();
  const { note_id, doc_id } = req.query;
  if (!note_id || !doc_id) {
    return res.status(400).json({ error: 'Missing note_id or doc_id', correlation_id: req.correlation_id });
  }
  next();
}

module.exports = { validateFieldNote, validateRecommendation };
