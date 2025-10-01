const express = require('express');
const cors = require('cors');
const path = require('path');
const { OpenAI } = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const { buildPrompt } = require('./promptBuilder');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Store conversation history per session (in-memory storage)
// Structure: Map<sessionId, { userId, messages: [], metadata }>
const sessionConversations = new Map();

// Generate unique user ID
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Generate unique session ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Clean up old sessions (older than 24 hours)
setInterval(() => {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    for (const [sessionId, session] of sessionConversations.entries()) {
        if (session.lastActivity < oneDayAgo) {
            sessionConversations.delete(sessionId);
        }
    }
}, 60 * 60 * 1000); // Run every hour

// Function to fetch pricing from printo.in
async function fetchProductPricing(productQuery) {
    try {
        // Search for product on printo.in
        const searchUrl = `https://printo.in/search?q=${encodeURIComponent(productQuery)}`;
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 8000
        });

        const $ = cheerio.load(response.data);
        let pricing = [];

        // More comprehensive price selectors
        const priceSelectors = [
            '.price', '.product-price', '[class*="price"]',
            '.amount', '.cost', '.rate', '[data-price]',
            '.pricing-info', '.price-range', '.product-amount'
        ];

        priceSelectors.forEach(selector => {
            $(selector).each((i, el) => {
                const priceText = $(el).text().trim();
                const priceMatch = priceText.match(/₹\s*[\d,]+(\.\d{2})?/g);
                if (priceMatch) {
                    pricing.push(...priceMatch);
                }
            });
        });

        // Remove duplicates and format
        const uniquePrices = [...new Set(pricing)].slice(0, 5);

        if (uniquePrices.length > 0) {
            return `Pricing: ${uniquePrices.join(', ')}`;
        }

        return 'Pricing available on website - call 9513734374 for exact rates';
    } catch (error) {
        console.log('Price fetch error:', error.message);
        return 'Pricing: Contact 9513734374 for current rates';
    }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { question, userId, sessionId } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        // Generate or use existing user ID
        let currentUserId = userId;
        if (!currentUserId) {
            currentUserId = generateUserId();
        }

        // Generate or use existing session ID
        let currentSessionId = sessionId;
        if (!currentSessionId) {
            currentSessionId = generateSessionId();
        }

        // Get or create session
        if (!sessionConversations.has(currentSessionId)) {
            sessionConversations.set(currentSessionId, {
                userId: currentUserId,
                messages: [],
                metadata: {
                    productInterest: null,
                    questionsAsked: [],
                    requirements: {},
                    startTime: Date.now(),
                    lastActivity: Date.now()
                }
            });
        }

        const session = sessionConversations.get(currentSessionId);
        session.metadata.lastActivity = Date.now();

        // Get conversation history for this session
        const sessionHistory = session.messages;

        // Keep only last 2 messages (1 user + 1 assistant) for context
        if (sessionHistory.length >= 4) {
            sessionHistory.splice(0, sessionHistory.length - 2);
        }

        // Extract product keywords for pricing lookup
        const productKeywords = question.toLowerCase().match(/\b(tshirt|t-shirt|polo|business card|stamp|photo|banner|brochure|flyer|letterhead|id card|notebook|box|sticker)\b/g);
        let currentPricing = '';

        if (productKeywords && productKeywords.length > 0) {
            try {
                currentPricing = await fetchProductPricing(productKeywords.join(' '));
            } catch (error) {
                currentPricing = 'Check printo.in for current pricing';
            }
        }

        // Build dynamic prompt using the modular system
        const currentDate = new Date().toLocaleDateString('en-IN');
        const systemPrompt = buildPrompt(question, currentDate, currentPricing, session.metadata);

        // Build messages array with system prompt + conversation history + new question
        const messages = [
            {
                role: "system",
                content: systemPrompt
            },
            ...sessionHistory,
            {
                role: "user",
                content: question
            }
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            max_tokens: 150,
            temperature: 0.3
        });

        const response = completion.choices[0].message.content;

        // Add the user question and AI response to session history
        sessionHistory.push(
            { role: "user", content: question },
            { role: "assistant", content: response }
        );

        res.json({
            success: true,
            response: response,
            userId: currentUserId,
            sessionId: currentSessionId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('OpenAI API Error:', error);
        res.status(500).json({
            error: 'Failed to get AI response',
            message: error.message
        });
    }
});

// Get all sessions for a user
app.get('/api/sessions/:userId', (req, res) => {
    const { userId } = req.params;
    const userSessions = [];

    for (const [sessionId, session] of sessionConversations.entries()) {
        if (session.userId === userId) {
            userSessions.push({
                sessionId,
                startTime: session.metadata.startTime,
                lastActivity: session.metadata.lastActivity,
                messageCount: session.messages.length
            });
        }
    }

    res.json({ success: true, sessions: userSessions });
});

// Create new session endpoint
app.post('/api/sessions/new', (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const newSessionId = generateSessionId();

    sessionConversations.set(newSessionId, {
        userId: userId,
        messages: [],
        metadata: {
            productInterest: null,
            questionsAsked: [],
            requirements: {},
            startTime: Date.now(),
            lastActivity: Date.now()
        }
    });

    res.json({
        success: true,
        sessionId: newSessionId,
        message: 'New session created'
    });
});

// Clear specific session
app.delete('/api/sessions/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    if (sessionConversations.has(sessionId)) {
        sessionConversations.delete(sessionId);
        res.json({ success: true, message: 'Session cleared' });
    } else {
        res.json({ success: true, message: 'Session not found' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Printo CS Assistant running on http://localhost:${PORT}`);
    console.log(`📝 Make sure to set OPENAI_API_KEY in your .env file`);
});