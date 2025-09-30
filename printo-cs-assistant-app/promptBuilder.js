const fs = require('fs');
const path = require('path');

// Load static files once on startup
let systemPrompt = '';
let productsData = {};

try {
    systemPrompt = fs.readFileSync(path.join(__dirname, 'system_prompt.txt'), 'utf8');
    productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8'));
} catch (error) {
    console.error('Error loading prompt files:', error.message);
}

/**
 * Builds a dynamic prompt based on user message and product context
 * @param {string} userMessage - The user's message/query
 * @param {string} currentDate - Current date string
 * @param {string} currentPricing - Any dynamic pricing data (optional)
 * @param {object} sessionContext - Session context with previous questions/requirements (optional)
 * @returns {string} - Complete system prompt
 */
function buildPrompt(userMessage, currentDate, currentPricing = '', sessionContext = null) {
    const lowerMessage = userMessage.toLowerCase();

    // Product keywords mapping
    const productMap = {
        'business card': 'businessCards',
        'visiting card': 'visitingCards',
        'letterhead': 'letterheads',
        'brochure': 'brochures',
        'flyer': 'flyers',
        'leaflet': 'leaflets',
        'banner': 'banners',
        'wedding card': 'weddingCards',
        'tshirt': 'tshirts',
        't-shirt': 'tshirts',
        'rubber stamp': 'rubberStamps',
        'document printing': 'documentPrinting',
        'poster': 'posters',
        'calendar': 'calendars',
        'notebook': 'notebooks',
        'envelope': 'envelopes',
        'qr code standee': 'qrCodeStandees',
        'qr standee': 'qrCodeStandees',
        'standee': 'qrCodeStandees'
    };

    // Find relevant products mentioned in user message
    const relevantProducts = [];
    for (const [keyword, productKey] of Object.entries(productMap)) {
        if (lowerMessage.includes(keyword)) {
            if (productsData[productKey]) {
                relevantProducts.push(productsData[productKey]);
            }
        }
    }

    // Build the complete prompt
    let prompt = systemPrompt.replace('${currentDate}', currentDate);

    // Add product context if relevant products found
    if (relevantProducts.length > 0) {
        prompt += '\n\n[PRODUCT CONTEXT]\n';
        relevantProducts.forEach(product => {
            prompt += `${product.name}:\n`;

            // Add pricing details
            Object.entries(product.pricing).forEach(([variant, price]) => {
                prompt += `- ${variant}: ${price}\n`;
            });

            prompt += `- Delivery: ${product.deliveryTime}\n`;
            prompt += `- Min quantity: ${product.minQuantity}\n\n`;
        });
    }

    // Add dynamic pricing if available
    if (currentPricing) {
        prompt += `\n[CURRENT PRICING]\n${currentPricing}\n`;
    }

    // Add session context if available
    if (sessionContext) {
        prompt += '\n[SESSION CONTEXT]\n';

        if (sessionContext.productInterest) {
            prompt += `Customer is interested in: ${sessionContext.productInterest}\n`;
        }

        if (sessionContext.questionsAsked && sessionContext.questionsAsked.length > 0) {
            prompt += `Questions already asked: ${sessionContext.questionsAsked.join(', ')}\n`;
        }

        if (Object.keys(sessionContext.requirements).length > 0) {
            prompt += 'Requirements gathered:\n';
            Object.entries(sessionContext.requirements).forEach(([key, value]) => {
                prompt += `- ${key}: ${value}\n`;
            });
        }

        prompt += '\nIMPORTANT: Use this context to provide relevant follow-up responses. Don\'t repeat questions already answered.\n';
    }

    return prompt;
}

module.exports = { buildPrompt };