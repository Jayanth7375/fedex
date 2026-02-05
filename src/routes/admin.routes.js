const express = require('express');
const router = express.Router();
const {
    getKPIs,
    getDashboardAnalytics,
    createDCA,
    getAllDCAs,
    getDCADetails,
    updateDCAStatus,
    assignCaseToDCA,
    getDCAManagers,
    createDCAManager,
    updateManagerStatus,
    updateDCA
} = require('../controllers/admin.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

router.route('/kpis')
    .get(protect, authorize('ADMIN'), getKPIs);

router.route('/analytics')
    .get(protect, authorize('ADMIN'), getDashboardAnalytics);

// DCA Mgt
router.route('/dca')
    .post(protect, authorize('ADMIN'), createDCA)
    .get(protect, authorize('ADMIN'), getAllDCAs);

router.route('/dca/:id')
    .get(protect, authorize('ADMIN'), getDCADetails)
    .put(protect, authorize('ADMIN'), updateDCA);

router.route('/dca/:id/status')
    .put(protect, authorize('ADMIN'), updateDCAStatus);

router.route('/dca/:id/managers')
    .get(protect, authorize('ADMIN'), getDCAManagers)
    .post(protect, authorize('ADMIN'), createDCAManager);

router.route('/managers/:id/status')
    .put(protect, authorize('ADMIN'), updateManagerStatus);

// Case Assignment
router.route('/cases/assign')
    .put(protect, authorize('ADMIN'), assignCaseToDCA);

// Non-Payment Review
router.route('/cases/:caseId/non-payment/review')
    .post(protect, authorize('ADMIN'), require('../controllers/admin.controller').reviewNonPayment);

module.exports = router;
