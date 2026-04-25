const express = require('express');
const router = express.Router();
const fieldNoteService = require('../services/fieldNoteService');
const { validateFieldNote } = require('../middleware/validate');

// POST /field-note
router.post('/', validateFieldNote, fieldNoteService.handleFieldNote);

module.exports = router;
