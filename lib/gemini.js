import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function validatePhoto(imageBuffer, expectedGesture) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `Analyze this photo for a water drinking reminder verification.

Expected gesture/pose: "${expectedGesture}"

Please analyze and respond in JSON format ONLY (no markdown, no explanation):
{
  "hasBottle": true/false (is there a water bottle, glass, or drinking container?),
  "hasFace": true/false (is there a person or face visible?),
  "isDrinking": true/false (does the person appear to be drinking or holding a drink?),
  "gestureMatch": true/false (does the gesture match "${expectedGesture}"?),
  "detectedGesture": "describe what gesture you see",
  "isRealPhoto": true/false (is this a real photo, not a screenshot or meme?),
  "isSafe": true/false (is the content appropriate/safe?),
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
        const response = await result.response;
        const text = response.text();

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('Gemini response not JSON:', text);
            return { error: 'Invalid response format', raw: text };
        }

        const validation = JSON.parse(jsonMatch[0]);
        return validation;

    } catch (error) {
        console.error('Gemini validation error:', error.message);
        return {
            error: error.message,
            hasBottle: false,
            hasFace: false,
            isSafe: true,
            confidence: 0
        };
    }
}

export async function quickValidate(imageBuffer) {
    // Simplified validation - just check if it's a real photo with a person
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `Is this a real photo (not screenshot/meme) showing a person with a drink/bottle? 
Reply ONLY: {"valid": true/false, "reason": "brief reason"}`;

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
        return { valid: true, reason: 'Unable to verify' };

    } catch (error) {
        console.error('Quick validate error:', error.message);
        return { valid: true, reason: 'Validation skipped due to error' };
    }
}
