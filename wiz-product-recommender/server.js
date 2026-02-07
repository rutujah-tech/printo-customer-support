/**
 * WIZ - Personalized Gift Generator
 * BotSpace WhatsApp Integration
 * Standardized for Node.js ESM
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import PersonalizationEngine from './personalization-engine.js';
import { GoogleGenAI } from '@google/genai';
import { getParsingPrompt, MODELS, DEFAULTS } from './prompts.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 80;

const wizEngine = new PersonalizationEngine({ geminiApiKey: process.env.GEMINI_API_KEY });
const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Store sessions by phone (in-memory)
const sessions = new Map();

app.use(cors());

// Custom JSON parser that handles malformed quotes from BotSpace
app.use(express.text({ type: 'application/json', limit: '50mb' }));
app.use((req, res, next) => {
    if (req.body && typeof req.body === 'string' && req.headers['content-type']?.includes('application/json')) {
        const rawBody = req.body;
        console.log('[JSON-RAW] Received:', rawBody.substring(0, 200));

        try {
            req.body = JSON.parse(rawBody);
        } catch (e) {
            // BotSpace sends unescaped quotes in customerdata/requirement
            console.log('[JSON-FIX] Parse failed, attempting fix...');
            try {
                // Extract fields manually using regex that handles unescaped quotes
                const phoneMatch = rawBody.match(/"phone"\s*:\s*"([^"]+)"/);
                const timestampMatch = rawBody.match(/"timestamp"\s*:\s*"([^"]+)"/);

                // For requirement/customerdata - find content between the key and the next key or end
                let requirement = '';
                const reqStart = rawBody.indexOf('"requirement"');
                const custStart = rawBody.indexOf('"customerdata"');
                const startIdx = reqStart > -1 ? reqStart : custStart;

                if (startIdx > -1) {
                    // Find the value start (after the colon and opening quote)
                    const colonIdx = rawBody.indexOf(':', startIdx);
                    const valueStart = rawBody.indexOf('"', colonIdx) + 1;

                    // Find the end - look for ", " followed by another key or closing brace
                    let valueEnd = -1;
                    const possibleEnds = ['", "timestamp"', '", "phone"', '"}', '" }'];
                    for (const end of possibleEnds) {
                        const idx = rawBody.indexOf(end, valueStart);
                        if (idx > -1 && (valueEnd === -1 || idx < valueEnd)) {
                            valueEnd = idx;
                        }
                    }

                    if (valueEnd > valueStart) {
                        requirement = rawBody.substring(valueStart, valueEnd);
                    }
                }

                req.body = {
                    phone: phoneMatch ? phoneMatch[1] : '',
                    requirement: requirement,
                    timestamp: timestampMatch ? timestampMatch[1] : ''
                };
                console.log('[JSON-FIX] Extracted:', { phone: req.body.phone, requirement: requirement.substring(0, 50) + '...' });
            } catch (e2) {
                console.error('[JSON-FIX] Could not fix JSON:', e2.message);
                req.body = {};
            }
        }
    }
    next();
});

app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Global Request Logger
app.use((req, res, next) => {
    console.log(`[GLOBAL] ${new Date().toISOString()} | ${req.method} ${req.url} | from ${req.ip}`);
    next();
});

// Fetch image from URL for processing
async function fetchImageAsBase64(imageUrl) {
    if (!imageUrl || imageUrl.toLowerCase() === 'no' || imageUrl.toLowerCase() === 'skip') return null;
    try {
        const response = await fetch(imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${base64}`;
    } catch (err) {
        console.error('[WIZ] Failed to fetch image:', err.message);
        return null;
    }
}

// Normalize requirement string from BotSpace payload
function normalizeRequirement(requirement) {
    if (requirement == null) return '';
    if (typeof requirement === 'object') {
        const url = requirement.url || requirement.image_url || requirement.mediaUrl || requirement.media_url;
        if (url && typeof url === 'string') return url.trim();
        return '';
    }
    if (typeof requirement === 'string') return requirement.trim();
    return String(requirement).trim();
}

// Parse customer data using AI (Smart extraction from free-form text)
// Prompt is defined in prompts.js - edit that file to customize parsing behavior
async function parseCustomerDataWithAI(dataString) {
    console.log('[WIZ] Parsing customer data with AI:', dataString);

    try {
        // Get prompt from prompts.js (edit prompts.js to customize)
        const prompt = getParsingPrompt(dataString);

        const response = await geminiClient.models.generateContent({
            model: MODELS.parsing,  // Model defined in prompts.js
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('[WIZ] AI Parse Response:', text);

        // Clean up response - remove markdown code blocks if present
        let cleanJson = text.trim();
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const parsed = JSON.parse(cleanJson);
        console.log('[WIZ] Parsed data:', parsed);

        return {
            recipientName: parsed.recipientName || DEFAULTS.recipientName,
            occasion: parsed.occasion || DEFAULTS.occasion,
            relationship: parsed.relationship || DEFAULTS.relationship,
            specialNotes: parsed.specialNotes || dataString,
            rawData: dataString
        };
    } catch (error) {
        console.error('[WIZ] AI Parse error:', error.message);
        // Fallback to defaults from prompts.js
        return {
            recipientName: DEFAULTS.recipientName,
            occasion: DEFAULTS.occasion,
            relationship: DEFAULTS.relationship,
            specialNotes: dataString,
            rawData: dataString
        };
    }
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/api/botspace/webhook', async (req, res) => {
    const requestStart = Date.now();
    console.log(`\n[BOTSPACE] [${new Date().toISOString()}] Webhook INCOMING:`, JSON.stringify(req.body));
    try {
        const { phone, name, requirement: rawRequirement, customerdata } = req.body;
        // Accept both 'requirement' and 'customerdata' field names from BotSpace
        const requirement = normalizeRequirement(rawRequirement || customerdata);

        if (!phone) return res.json({ success: false, message: 'Missing phone' });
        if (!requirement) return res.json({ success: false, message: 'Missing requirement' });

        const requirementLower = requirement.toLowerCase();
        const isPhotoCall = requirement.startsWith('http') || requirementLower === 'no' || requirementLower === 'skip';

        if (!isPhotoCall) {
            // Step 1: Data Gathering - Use AI to parse free-form text
            console.log(`[BOTSPACE] Step 1 - Data for ${phone}`);
            const parsed = await parseCustomerDataWithAI(requirement);
            sessions.set(phone, { ...parsed, rawRequirement: requirement, senderName: name, timestamp: Date.now() });
            return res.json({
                success: true,
                message: 'Got it! Now share a photo or type "NO" to skip.',
                text: 'Got it! Now share a photo or type "NO" to skip.',
                status: 'awaiting_photo'
            });
        }

        // Step 2: Creative Generation
        console.log(`[BOTSPACE] Step 2 - Generation for ${phone}`);
        const session = sessions.get(phone);
        if (!session) return res.json({ success: false, message: 'Start again by sending gift details.' });

        let photo = null;
        if (requirement.startsWith('http')) {
            photo = await fetchImageAsBase64(requirement);
        }

        const result = await wizEngine.createPersonalizedFile({
            recipientName: session.recipientName || 'Friend',  // Never use sender name as recipient
            occasion: session.occasion || 'Special Day',
            relationship: session.relationship || 'Friend',
            specialNotes: session.specialNotes || session.rawRequirement || session.rawData || 'Quirky gift',
            photo
        });

        console.log('[WIZ] Generating with:', {
            recipientName: session.recipientName,
            occasion: session.occasion,
            relationship: session.relationship,
            specialNotes: session.specialNotes?.substring(0, 50) + '...'
        });

        sessions.delete(phone);

        if (result.success) {
            let publicImageUrl = null;
            if (result.result.imageUrl && result.result.imageUrl.startsWith('data:image')) {
                try {
                    const generatedDir = path.join(__dirname, 'public', 'generated');
                    if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });

                    const filename = `gift_${phone}_${Date.now()}.png`;
                    const filePath = path.join(generatedDir, filename);
                    const base64Data = result.result.imageUrl.replace(/^data:image\/\w+;base64,/, "");
                    fs.writeFileSync(filePath, base64Data, 'base64');

                    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                    const host = req.get('host');
                    publicImageUrl = `${protocol}://${host}/generated/${filename}`;
                    console.log(`[BOTSPACE] Design Live: ${publicImageUrl}`);
                } catch (err) {
                    console.error('[BOTSPACE] Disk save error:', err.message);
                }
            }

            return res.json({
                success: true,
                message: '🎁 Gift design ready!',
                text: '🎁 Gift design ready!',
                copy: result.result.copy || '',
                image_url: publicImageUrl || result.result.imageUrl
            });
        } else {
            return res.json({ success: false, message: 'Generation failed. Try again.' });
        }
    } catch (error) {
        console.error('[BOTSPACE] Error:', error.message);
        const errResp = { success: false, message: 'Error: ' + error.message };
        console.log(`[BOTSPACE] [${Date.now() - requestStart}ms] Sending Error Response:`, JSON.stringify(errResp));
        return res.json(errResp);
    }
});

// Final logging wrapper for all responses
const originalJson = app.response.json;
app.response.json = function (body) {
    if (this.req && this.req.url === '/api/botspace/webhook') {
        // requestStart is not in scope here easily, so we'll just log the body
        console.log(`[BOTSPACE] Sending response:`, JSON.stringify(body));
    }
    return originalJson.call(this, body);
};

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'WIZ', version: '3.0' }));
app.listen(PORT, () => console.log(`[WIZ] Server live on port ${PORT}`));
