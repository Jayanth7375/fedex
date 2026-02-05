const axios = require('axios');

const verifyApiLogin = async () => {
    try {
        console.log('Attempting login via API...');
        const response = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'manager@dca-alpha.com',
            password: 'password123'
        });

        console.log('Response Status:', response.status);
        console.log('Login SUCCEEDED!');
        console.log('Token received:', response.data.token ? 'YES' : 'NO');
    } catch (error) {
        console.error('Login FAILED');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

verifyApiLogin();
