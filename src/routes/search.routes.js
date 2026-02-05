const express = require('express');
const router = express.Router();
const { searchGlobal } = require('../controllers/search.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, searchGlobal);

module.exports = router;
