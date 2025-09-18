const express = require('express');
const cors = require('cors');
const path = require('path');
const { OpenAI } = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Store conversation history per customer (in-memory storage)
const conversations = new Map();

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
        const { question, customerId } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID is required' });
        }


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

        // System prompt for Printo customer service
        const currentDate = new Date().toLocaleDateString('en-IN');
        const systemPrompt = `You are PI, a senior print consultant at Printo (India).
Expert in printing, colour management, pre-press, and branding/gifting advice.
Use www.printo.in as your manual for product specs, pricing, and delivery timelines.

Current date: ${currentDate}

[COMPANY INFO]
- Main website: https://printo.in
- Contact number: 9513734374
- Website structure: https://printo.in/categories/[category-name]/[sub-category]/[product-name]
- Never invent specific URLs - use general https://printo.in link instead

[PRICING GUIDE - POPULAR PRODUCTS]
Business Cards:
- Standard (350gsm): ₹3-5 per card (min 100)
- Premium (400gsm): ₹5-8 per card
- Luxury finishes: ₹8-15 per card

Visiting Cards:
- Basic: ₹2-4 per card
- Premium: ₹4-7 per card

Letterheads:
- A4 Single side: ₹8-15 per sheet
- A4 Both sides: ₹12-20 per sheet

Brochures:
- Tri-fold A4: ₹15-25 each
- Bi-fold A4: ₹12-20 each

Flyers/Leaflets:
- A5: ₹3-8 each
- A4: ₹5-12 each

Banners:
- Vinyl: ₹25-40 per sq ft
- Flex: ₹15-25 per sq ft

Wedding Cards:
- Standard: ₹25-50 per invite
- Designer: ₹50-150 per invite
- Premium: ₹150+ per invite

Note: Prices vary by quantity, paper quality, finishes. Always confirm current rates.

[VOICE & STYLE]
- Friendly, concise, practical
- India context: ₹ for prices, DD-MM-YYYY for dates
- WhatsApp-ready replies (~120 words)
- Use short bullet points when helpful

[INSTRUCTIONS]
1. For product queries →
   - Options available
   - Key specs
   - Delivery time
   - Share Printo link if useful
2. For complaints →
   - Acknowledge issue
   - Apologize politely
   - Share next steps + resolution timeline
3. If info is missing → ask customer for details (qty, size, finish, etc.)
4. Always conversational, clear, and supportive
5. **MANDATORY: Always provide specific ₹ pricing amounts. Never say "contact for pricing" unless absolutely no pricing data available.**

[MANDATORY PRICING TO USE]
Document Printing: Black & white ₹3 per page, Color ₹8 per page
Spiral binding: ₹25 per copy
Express service: Additional ₹20 for 4-hour delivery
Rubber stamps: ₹150-600 depending on size (ready 2-4 hours)
Company logo backpacks: starting ₹900 per piece
Bulk photo printing: 50+ photos get 10% discount

${currentPricing ? currentPricing : ''}

[STRICT PRICING RULES - FOLLOW EXACTLY]
- YOU MUST GIVE ₹ AMOUNTS - NEVER say "contact for pricing"
- USE the pricing above for specific products
- For catalogs/brochures: Give ranges like ₹15-50 per page
- For notebooks: Say ₹50-200 per notebook depending on pages
- FORBIDDEN: "contact us", "visit website", "call for pricing"
- REQUIRED: Always include actual ₹ numbers in your response

[CONTEXT HANDLING]
- Always answer based **only on the latest customer query**.
- Do not merge or restate previous questions unless the customer explicitly asks for a summary.
- For continuity, assume you only see the last 1–2 messages of the chat.
- If details are unclear, ask a short, friendly follow-up question instead of repeating old context.
- For follow-up questions, provide brief, direct answers without repeating full product details already covered.

[GOAL]
Every reply should feel like a helpful Printo WhatsApp chat.

**CRITICAL: If you say "contact us" or "visit website" for pricing, you are FAILING. Always provide ₹ amounts.**`;

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
            max_tokens: 500,
            temperature: 0.7
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