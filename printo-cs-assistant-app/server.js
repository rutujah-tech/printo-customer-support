const express = require('express');
const cors = require('cors');
const path = require('path');
const { OpenAI } = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const { buildPrompt } = require('./promptBuilder');
const GoogleSheetsLogger = require('./google-sheets-logger');
const BotSpaceService = require('./botspace-service');
const { addUTMToResponse } = require('./utm-tracker');
const { getPhoneFromBotspaceResponse } = require('./phone-extractor');
const { getOrdersByMobile } = require('./pia-api-client');
const { formatOrdersForWhatsApp, formatErrorMessage, formatOrderDetails } = require('./order-status-formatter');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Google Sheets Logger
const sheetsLogger = new GoogleSheetsLogger();

// Initialize BotSpace Service
const botSpaceService = new BotSpaceService();

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

// Extract product type from user message
function extractProduct(message) {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('business card') || lowerMessage.includes('visiting card')) return 'business-cards';
    if (lowerMessage.includes('t-shirt') || lowerMessage.includes('tshirt')) return 't-shirts';
    if (lowerMessage.includes('banner')) return 'banners';
    if (lowerMessage.includes('stamp')) return 'rubber-stamps';
    if (lowerMessage.includes('document') || lowerMessage.includes('print')) return 'document-printing';
    if (lowerMessage.includes('notebook')) return 'notebooks';
    if (lowerMessage.includes('brochure')) return 'brochures';
    if (lowerMessage.includes('letterhead')) return 'letterheads';
    if (lowerMessage.includes('wedding') || lowerMessage.includes('invitation')) return 'wedding-cards';
    if (lowerMessage.includes('poster')) return 'posters';
    return 'general-inquiry';
}

// Extract pincode from user message
function extractPincode(message) {
    const pincodeMatch = message.match(/\b\d{6}\b/);
    return pincodeMatch ? pincodeMatch[0] : 'N/A';
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

// Function to handle order status queries from BotSpace
async function handleOrderStatusQuery(botspaceResponse, session) {
    try {
        console.log('📞 Processing order status query from BotSpace');

        // Extract phone number from BotSpace response
        const phone = getPhoneFromBotspaceResponse(botspaceResponse);

        if (!phone) {
            return {
                success: false,
                message: 'Please provide a valid 10-digit mobile number to check your order status.'
            };
        }

        console.log(`✅ Extracted phone: ${phone}`);

        // Query PIA API
        const result = await getOrdersByMobile(phone);

        if (!result.success) {
            // Handle errors
            if (result.error === 'TOKEN_EXPIRED') {
                console.error('⚠️  PIA token expired');
            }
            const errorMsg = formatErrorMessage(result.error);
            return {
                success: false,
                message: errorMsg
            };
        }

        // Check if orders found
        if (!result.orders || result.orders.length === 0) {
            return {
                success: true,
                message: `I couldn't find any orders for mobile number ${phone}.\n\nPossible reasons:\n• Order was placed with a different number\n• Order is more than 6 months old\n\nPlease check your order confirmation email or contact support: 1800-XXX-XXXX`
            };
        }

        // Format orders for WhatsApp
        const page = session.metadata.orderPage || 0;
        const formattedMessage = formatOrdersForWhatsApp(result.orders, page);

        // Store orders in session for pagination
        session.metadata.currentOrders = result.orders;
        session.metadata.orderPage = page;

        return {
            success: true,
            message: formattedMessage,
            ordersCount: result.count
        };

    } catch (error) {
        console.error('❌ Order status query error:', error.message);
        return {
            success: false,
            message: 'Unable to fetch order status. Please try again or contact support: 1800-XXX-XXXX'
        };
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
    const startTime = Date.now(); // Track request start time

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

        // ============================================
        // ORDER STATUS DETECTION
        // ============================================
        // Check if this is an order status query (contains phone number)
        const phoneExtraction = require('./phone-extractor');
        const potentialPhone = phoneExtraction.getPhoneFromBotspaceResponse(question);

        if (potentialPhone) {
            // This appears to be an order status query with a phone number
            console.log('📞 Order status query detected with phone:', potentialPhone);

            const orderStatusResult = await handleOrderStatusQuery(question, session);

            if (orderStatusResult.success) {
                // Log to Google Sheets
                sheetsLogger.logConversation({
                    sessionId: currentSessionId,
                    userInput: question,
                    botResponse: orderStatusResult.message,
                    product: 'Order Status',
                    pincode: null,
                    status: 'success',
                    responseTime: Date.now() - startTime
                }).catch(err => console.error('Background logging error:', err.message));

                // Add to session history
                session.messages.push(
                    { role: "user", content: question },
                    { role: "assistant", content: orderStatusResult.message }
                );

                return res.json({
                    success: true,
                    response: orderStatusResult.message,
                    userId: currentUserId,
                    sessionId: currentSessionId,
                    timestamp: new Date().toISOString(),
                    orderStatus: true,
                    ordersCount: orderStatusResult.ordersCount || 0
                });
            }
            // If order status query failed, fall through to normal chat flow
        }

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

        let response = completion.choices[0].message.content;

        // Add UTM tracking to all printo.in URLs in the response
        response = addUTMToResponse(response);

        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Extract product and pincode for logging
        const detectedProduct = extractProduct(question);
        const detectedPincode = extractPincode(question);

        // Log to Google Sheets asynchronously (don't block response)
        sheetsLogger.logConversation({
            sessionId: currentSessionId,
            userInput: question,
            botResponse: response,
            product: detectedProduct,
            pincode: detectedPincode,
            status: 'success',
            responseTime: responseTime
        }).catch(err => {
            console.error('Background logging error:', err.message);
        });

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

        // Calculate response time even for errors
        const responseTime = Date.now() - startTime;

        // Log error to Google Sheets
        const { question, sessionId } = req.body;
        const currentSessionId = sessionId || 'unknown';

        sheetsLogger.logConversation({
            sessionId: currentSessionId,
            userInput: question || 'N/A',
            botResponse: `ERROR: ${error.message}`,
            product: question ? extractProduct(question) : 'N/A',
            pincode: question ? extractPincode(question) : 'N/A',
            status: 'error',
            responseTime: responseTime
        }).catch(err => {
            console.error('Background logging error:', err.message);
        });

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
    try {
        const fs = require('fs');
        const productsData = JSON.parse(fs.readFileSync('./scraped_products.json', 'utf8'));

        // Calculate scraper health
        const successRate = ((productsData.successfulCategories / productsData.totalCategories) * 100).toFixed(1);
        const failedCategories = productsData.totalCategories - productsData.successfulCategories;

        // Determine scraper status
        let scraperStatus = 'HEALTHY';
        if (failedCategories > 20) scraperStatus = 'DEGRADED';
        if (failedCategories > 40 || productsData.totalProducts === 0) scraperStatus = 'FAILED';

        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            dataVersion: {
                lastUpdated: productsData.lastUpdated,
                totalProducts: productsData.totalProducts,
                totalCategories: productsData.totalCategories,
                versionNumber: new Date(productsData.lastUpdated).getTime(),
                nextScheduledUpdate: 'Every Sunday at 1:00 AM IST'
            },
            scraperHealth: {
                status: scraperStatus,
                successfulCategories: productsData.successfulCategories,
                totalCategories: productsData.totalCategories,
                failedCategories: failedCategories,
                successRate: `${successRate}%`,
                hasData: productsData.totalProducts > 0
            }
        });
    } catch (error) {
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            dataVersion: {
                error: 'Could not load product data'
            },
            scraperHealth: {
                status: 'FAILED',
                error: error.message
            }
        });
    }
});

// Diagnostic endpoint to check Google Sheets configuration
app.get('/debug/sheets-config', (req, res) => {
    const config = {
        googleSheetsEnabled: sheetsLogger.enabled,
        hasSheetId: !!process.env.GOOGLE_SHEET_ID,
        hasServiceEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
        sheetIdLength: process.env.GOOGLE_SHEET_ID ? process.env.GOOGLE_SHEET_ID.length : 0,
        emailDomain: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.split('@')[1] : 'N/A',
        privateKeyStart: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.substring(0, 30) + '...' : 'N/A'
    };
    res.json(config);
});

// BotSpace Webhook Endpoint
app.post('/api/botspace/webhook', async (req, res) => {
    const startTime = Date.now();

    try {
        console.log('BotSpace webhook received:', JSON.stringify(req.body, null, 2));

        // Extract data from BotSpace webhook
        const { data, message } = req.body;

        // Get user details from data object
        const userData = data || {};
        const phone = userData.fullPhoneNumber || userData.phone;
        const name = userData.name || 'Customer';
        const userId = `botspace_${phone}`;
        const sessionId = `botspace_${phone}`;

        // Get the actual message - BotSpace might send it in different formats
        const question = message?.text || message || req.body.question || req.body.text;

        if (!question) {
            console.error('No message found in webhook:', req.body);
            return res.status(400).json({
                error: 'Message is required',
                received: req.body
            });
        }

        console.log(`Processing message from ${name} (${phone}): ${question}`);

        // Get or create session
        if (!sessionConversations.has(sessionId)) {
            sessionConversations.set(sessionId, {
                userId: userId,
                messages: [],
                metadata: {
                    productInterest: null,
                    questionsAsked: [],
                    requirements: {},
                    startTime: Date.now(),
                    lastActivity: Date.now(),
                    customerName: name,
                    customerPhone: phone
                }
            });
        }

        const session = sessionConversations.get(sessionId);
        session.metadata.lastActivity = Date.now();
        const sessionHistory = session.messages;

        // Keep only last 2 messages for context
        if (sessionHistory.length >= 4) {
            sessionHistory.splice(0, sessionHistory.length - 2);
        }

        // Build dynamic prompt
        const currentDate = new Date().toLocaleDateString('en-IN');
        const systemPrompt = buildPrompt(question, currentDate, '', session.metadata);

        // Build messages array
        const messages = [
            { role: "system", content: systemPrompt },
            ...sessionHistory,
            { role: "user", content: question }
        ];

        // 🔍 DEBUG: Log exact prompt being sent to OpenAI API
        const promptLog = {
            timestamp: new Date().toISOString(),
            sessionId: sessionId,
            messageNumber: Math.floor(sessionHistory.length / 2) + 1,
            apiRequest: {
                model: "gpt-4o",
                max_tokens: 150,
                temperature: 0.3,
                messages: messages
            }
        };

        // Save to file for inspection
        const fs = require('fs');
        const logFileName = `prompt-log-${sessionId}-msg${promptLog.messageNumber}.json`;
        fs.writeFileSync(logFileName, JSON.stringify(promptLog, null, 2), 'utf-8');
        console.log(`\n📝 Prompt logged to: ${logFileName}`);
        console.log(`📊 Session history length: ${sessionHistory.length} messages`);
        console.log(`🔢 This is message #${promptLog.messageNumber} in conversation\n`);

        // Get AI response
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            max_tokens: 150,
            temperature: 0.3
        });

        let response = completion.choices[0].message.content;
        const responseTime = Date.now() - startTime;

        // 🔗 Add UTM tracking to all printo.in URLs in the response
        response = addUTMToResponse(response, sessionId, phone);
        console.log(`🔗 UTM tracking added to response URLs`);

        // Update conversation history
        sessionHistory.push({ role: "user", content: question });
        sessionHistory.push({ role: "assistant", content: response });

        // Extract product and pincode for logging
        const detectedProduct = extractProduct(question);
        const detectedPincode = extractPincode(question);

        // Log to Google Sheets
        sheetsLogger.logConversation({
            sessionId: sessionId,
            userInput: question,
            botResponse: response,
            product: detectedProduct,
            pincode: detectedPincode,
            status: 'success',
            responseTime: responseTime,
            source: 'botspace',
            customerName: name,
            customerPhone: phone
        }).catch(err => console.error('Sheets logging error:', err));

        console.log(`✅ AI Response generated for ${name}: ${response}`);

        // Send response back to customer via BotSpace WhatsApp
        let botspaceSendResult = null;
        if (botSpaceService.isConfigured()) {
            try {
                // Try to send via session message first (if conversationId available)
                if (userData.id) {
                    botspaceSendResult = await botSpaceService.sendSessionMessage(
                        userData.id,
                        response
                    );
                } else if (phone) {
                    // Fallback to direct phone message
                    botspaceSendResult = await botSpaceService.sendMessageWithRetry(
                        phone,
                        response
                    );
                }
                console.log(`📱 WhatsApp message sent successfully to ${phone}`);
            } catch (sendError) {
                console.error(`❌ Failed to send WhatsApp message to ${phone}:`, sendError);
                // Don't fail the webhook - log the error and continue
            }
        } else {
            console.warn('⚠️  BotSpace not configured - response not sent to WhatsApp');
        }

        // Return success response to BotSpace webhook
        res.json({
            success: true,
            response: response,
            userId: userId,
            sessionId: sessionId,
            whatsappSent: !!botspaceSendResult,
            messageId: botspaceSendResult?.messageId || null
        });

    } catch (error) {
        console.error('❌ BotSpace webhook error:', error);
        const responseTime = Date.now() - startTime;

        // Log error to Google Sheets
        sheetsLogger.logConversation({
            sessionId: sessionId || 'unknown',
            userInput: req.body.message || 'unknown',
            botResponse: `ERROR: ${error.message}`,
            product: 'error',
            pincode: '',
            status: 'failed',
            responseTime: responseTime,
            source: 'botspace'
        }).catch(err => console.error('Sheets logging error:', err));

        res.status(500).json({
            success: false,
            error: 'Failed to process message',
            message: error.message
        });
    }
});

// Test endpoint to manually log to Google Sheets
app.post('/debug/test-log', async (req, res) => {
    try {
        await sheetsLogger.logConversation({
            sessionId: `debug_test_${Date.now()}`,
            userInput: 'This is a test message from AWS',
            botResponse: 'Testing Google Sheets logging functionality',
            product: 'test-product',
            pincode: '560001',
            status: 'success',
            responseTime: 100
        });

        res.json({
            success: true,
            message: 'Test log sent to Google Sheets. Check your sheet!',
            sheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

app.listen(PORT, async () => {
    console.log(`🚀 Printo CS Assistant running on http://localhost:${PORT}`);
    console.log(`📝 Make sure to set OPENAI_API_KEY in your .env file`);

    // Test Google Sheets connection on startup
    await sheetsLogger.testConnection();

    // Initialize headers if needed
    await sheetsLogger.initializeHeaders();
});