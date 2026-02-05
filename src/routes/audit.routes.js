const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/audit.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

router.route('/')
    .get(protect, authorize('ADMIN', 'MANAGER', 'DCA_MANAGER'), getAuditLogs);

module.exports = router;
