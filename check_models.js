const https = require('https');
const fs = require('fs');

const API_KEY = "AIzaSyD-2ZySfzPsuvtkk50EePtxlhtQZyiA7UI";

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models?key=${API_KEY}`,
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

console.log("Checking available models...");

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const parsedData = JSON.parse(data);
            fs.writeFileSync('models.json', JSON.stringify(parsedData, null, 2));
            console.log("Models saved to models.json");
        } catch (e) {
            console.error("Failed to parse response:", e);
            console.log("Raw output:", data);
        }
    });
});

req.on('error', (error) => {
    console.error("Error:", error);
});

req.end();
