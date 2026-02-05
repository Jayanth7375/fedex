const express = require('express');
const router = express.Router();
const { generateReport, getReport } = require('../controllers/reconciliation.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

router.post('/generate', protect, authorize('ADMIN'), generateReport);
router.get('/:reportId', protect, getReport);

module.exports = router;
