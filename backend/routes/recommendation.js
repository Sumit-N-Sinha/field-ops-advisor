const express = require('express');
const router = express.Router();
const fieldNoteService = require('../services/fieldNoteService');
const { validateRecommendation } = require('../middleware/validate');

// GET /recommendation
router.get('/', validateRecommendation, fieldNoteService.handleRecommendation);

module.exports = router;
