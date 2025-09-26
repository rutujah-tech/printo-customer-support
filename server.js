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

// Store conversation history per customer (in-memory storage)
const conversations = new Map();

// Store session context (questions asked, product interest, requirements gathered)
const sessions = new Map();

// Generate unique session ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

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
        const { question, customerId, sessionId } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID is required' });
        }

        // Generate or use existing session ID
        let currentSessionId = sessionId;
        if (!currentSessionId) {
            currentSessionId = generateSessionId();
        }

        // Get or create session context
        if (!sessions.has(currentSessionId)) {
            sessions.set(currentSessionId, {
                customerId: customerId,
                productInterest: null,
                questionsAsked: [],
                requirements: {},
                startTime: new Date(),
                lastActivity: new Date()
            });
        }

        const sessionContext = sessions.get(currentSessionId);
        sessionContext.lastActivity = new Date();

        // Get or create conversation history for this customer
        if (!conversations.has(customerId)) {
            conversations.set(customerId, []);
        }

        const customerHistory = conversations.get(customerId);

        // Keep only last 2 messages (1 user + 1 assistant) for context
        if (customerHistory.length >= 4) {
            customerHistory.splice(0, customerHistory.length - 2);
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
        const systemPrompt = buildPrompt(question, currentDate, currentPricing, sessionContext);

        // Build messages array with system prompt + conversation history + new question
        const messages = [
            {
                role: "system",
                content: systemPrompt
            },
            ...customerHistory,
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

        // Add the user question and AI response to conversation history
        customerHistory.push(
            { role: "user", content: question },
            { role: "assistant", content: response }
        );

        res.json({
            success: true,
            response: response,
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

// Clear conversation history for a customer
app.delete('/api/conversation/:customerId', (req, res) => {
    const { customerId } = req.params;

    if (conversations.has(customerId)) {
        conversations.delete(customerId);
        res.json({ success: true, message: 'Conversation history cleared' });
    } else {
        res.json({ success: true, message: 'No conversation history found' });
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