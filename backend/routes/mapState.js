// Handles /map-state endpoint
const express = require('express');
const router = express.Router();
const mapStateService = require('../services/mapStateService');

// GET /map-state
router.get('/', mapStateService.handleGetMapState);

module.exports = router;
