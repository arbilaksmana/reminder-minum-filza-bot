const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function validatePhoto(imageBuffer, expectedGesture) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Analyze this photo for a water drinking reminder verification.
Expected gesture: "${expectedGesture}"

Respond in JSON ONLY:
{
  "hasBottle": boolean,
  "hasFace": boolean,
  "isDrinking": boolean,
  "gestureMatch": boolean,
  "isRealPhoto": boolean,
  "isSafe": boolean,
  "confidence": 0-100,
  "reason": "brief explanation"
}`;

        const imagePart = {
            inlineData: {
                data: imageBuffer.toString('base64'),
                mimeType: 'image/jpeg'
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { error: 'Invalid response', raw: text };

    } catch (error) {
        console.error('Gemini error:', error.message);
        return { error: error.message, isSafe: true, confidence: 0 };
    }
}

module.exports = { validatePhoto };
