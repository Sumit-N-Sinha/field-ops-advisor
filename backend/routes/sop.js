// Handles /sops endpoint
const express = require('express');
const router = express.Router();
const sopService = require('../services/sopService');

// GET /sops
router.get('/', sopService.handleGetSops);

module.exports = router;
