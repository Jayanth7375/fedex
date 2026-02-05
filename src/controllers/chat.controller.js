const https = require('https');

// Securely use the Google API Key on the server side
const API_KEY = "AIzaSyD-2ZySfzPsuvtkk50EePtxlhtQZyiA7UI";

exports.sendMessage = async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages) {
            return res.status(400).json({ message: "Messages are required" });
        }

        // Convert OpenAI-style messages to Gemini format
        // OpenAI: [{role: 'user', content: '...'}, {role: 'assistant', content: '...'}]
        // Gemini: contents: [{ role: 'user', parts: [{ text: '...' }] }, { role: 'model', parts: [{ text: '...' }] }]

        let systemInstruction = null;
        const geminiContents = messages.reduce((acc, msg) => {
            if (msg.role === 'system') {
                systemInstruction = {
                    parts: [{ text: msg.content }]
                };
                return acc;
            }

            // Map 'assistant' to 'model' for Gemini
            const role = msg.role === 'assistant' ? 'model' : 'user';

            acc.push({
                role: role,
                parts: [{ text: msg.content }]
            });
            return acc;
        }, []);

        const requestBody = JSON.stringify({
            contents: geminiContents,
            systemInstruction: systemInstruction,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 800
            }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const apiRequest = https.request(options, (apiRes) => {
            let data = '';

            apiRes.on('data', (chunk) => {
                data += chunk;
            });

            apiRes.on('end', () => {
                if (apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                    try {
                        const parsedData = JSON.parse(data);
                        // Extract text from Gemini response structure
                        const botText = parsedData.candidates?.[0]?.content?.parts?.[0]?.text;

                        if (botText) {
                            // Send back in a format compatible with our frontend (OpenAI-like structure)
                            res.json({
                                choices: [{
                                    message: {
                                        content: botText
                                    }
                                }]
                            });
                        } else {
                            res.status(500).json({ message: "No content generated" });
                        }
                    } catch (e) {
                        console.error("Parse Error:", e);
                        res.status(500).json({ message: "Failed to parse Gemini response" });
                    }
                } else {
                    try {
                        const errorData = JSON.parse(data);
                        console.error("Gemini API Error:", JSON.stringify(errorData, null, 2));
                        res.status(apiRes.statusCode).json({ message: errorData.error?.message || "Gemini API Error" });
                    } catch (e) {
                        res.status(apiRes.statusCode).json({ message: "Gemini API Error" });
                    }
                }
            });
        });

        apiRequest.on('error', (error) => {
            console.error(error);
            res.status(500).json({ message: "Failed to connect to AI service" });
        });

        apiRequest.write(requestBody);
        apiRequest.end();

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
