const mongoose = require('mongoose');
const dotenv = require('dotenv');
const DCA = require('./src/models/DCA');

dotenv.config();

const migrateDCAs = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const legacyDCAs = [
            { name: 'Alpha Collections', code: 'DCA-Alpha', status: 'ACTIVE', contactEmail: 'contact@dca-alpha.com' },
            { name: 'Beta Recoveries', code: 'DCA-Beta', status: 'ACTIVE', contactEmail: 'contact@dca-beta.com' }
        ];

        for (const data of legacyDCAs) {
            const exists = await DCA.findOne({ code: data.code });
            if (!exists) {
                await DCA.create(data);
                console.log(`Created Legacy DCA: ${data.name} (${data.code})`);
            } else {
                console.log(`Legacy DCA exists: ${data.code}`);
            }
        }

        console.log('Migration Complete');
        process.exit();
    } catch (error) {
        console.error('Migration Failed:', error);
        process.exit(1);
    }
};

migrateDCAs();
