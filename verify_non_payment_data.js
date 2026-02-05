const mongoose = require('mongoose');
const Case = require('./src/models/Case');
require('dotenv').config();

const verifyData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const pendingRequests = await Case.find({ 'nonPaymentRequest.status': 'PENDING' });
        console.log(`Found ${pendingRequests.length} pending non-payment requests.`);

        pendingRequests.forEach(c => {
            console.log(`CaseID: ${c.caseId}, Status: ${c.status}, Reason: ${c.nonPaymentRequest.reason}, ReqStatus: ${c.nonPaymentRequest.status}`);
        });

        const statusCases = await Case.find({ status: { $in: ['NOT_ABLE_TO_PAY', 'CUSTOMER_DECLINED'] } });
        console.log(`Found ${statusCases.length} cases with non-payment STATUS.`);

        statusCases.forEach(c => {
            console.log(`CaseID: ${c.caseId}, Status: ${c.status}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
};

verifyData();
