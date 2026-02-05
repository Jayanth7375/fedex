const express = require('express');
const router = express.Router();
const { createAgent, getAgents, getDCAStats, updateAgent, getPerformanceHistory, getAgentRecommendations } = require('../controllers/manager.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

router.route('/agents')
    .post(protect, authorize('MANAGER', 'DCA_MANAGER'), createAgent)
    .get(protect, authorize('MANAGER', 'DCA_MANAGER'), getAgents);

router.route('/agents/recommendations/:caseId')
    .get(protect, authorize('MANAGER', 'DCA_MANAGER'), getAgentRecommendations);

router.route('/agents/:id')
    .put(protect, authorize('MANAGER', 'DCA_MANAGER'), updateAgent);

router.route('/stats')
    .get(protect, authorize('MANAGER', 'DCA_MANAGER'), getDCAStats);

router.route('/performance')
    .get(protect, authorize('MANAGER', 'DCA_MANAGER'), getPerformanceHistory);

module.exports = router;
