const express = require('express');
const router = express.Router();
const { getCases, getCaseById, updateCaseStatus, assignCase, getPersonHistory, createCase, addNote, addPayment, importCases, getAgentStats } = require('../controllers/case.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');
const internalAuth = require('../middleware/internalAuth');

router.route('/')
    .get(protect, getCases)
    .post(protect, authorize('ADMIN', 'MANAGER'), createCase);

router.route('/stats/agent')
    .get(protect, getAgentStats);

router.route('/person/:customerId')
    .get(protect, getPersonHistory);

router.route('/financials/pending')
    .get(protect, authorize('ADMIN'), require('../controllers/case.controller').getPendingFinancials);

// Bulk Import (n8n - Internal Secret) - MUST BE BEFORE /:id route
router.route('/import-internal')
    .post(internalAuth, importCases);

// Bulk Import (Frontend - JWT)
router.route('/import')
    .post(protect, authorize('ADMIN'), importCases);

router.route('/:id')
    .get(protect, getCaseById);

router.route('/:id/status')
    .put(protect, updateCaseStatus);

router.route('/:id/assign')
    .put(protect, authorize('ADMIN', 'MANAGER', 'DCA_MANAGER'), assignCase);

router.route('/:id/notes')
    .post(protect, addNote);

router.route('/:id/payment')
    .post(protect, addPayment);

// Financial Workflows
router.route('/:id/payment/:paymentId/verify')
    .post(protect, authorize('ADMIN'), require('../controllers/case.controller').verifyPayment);

router.route('/:id/settlement')
    .post(protect, require('../controllers/case.controller').requestSettlement);

router.route('/:id/non-payment')
    .post(protect, require('../controllers/case.controller').requestNonPayment);

router.route('/:id/settlement/adjudicate')
    .post(protect, authorize('ADMIN'), require('../controllers/case.controller').adjudicateSettlement);

module.exports = router;