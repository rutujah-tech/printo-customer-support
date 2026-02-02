const fs = require('fs');
const path = require('path');
const { addUTMTracking } = require('./utm-tracker');

// Product data from Google Sheets
let systemPrompt = '';
let products = [];
let lastProductLoadTime = null;

/**
 * Load product data from Google Sheets JSON file
 */
function loadProductData() {
    try {
        // Load system prompt
        try {
            systemPrompt = fs.readFileSync(path.join(__dirname, 'system_prompt', 'system_prompt.txt'), 'utf8');
        } catch {
            systemPrompt = fs.readFileSync(path.join(__dirname, 'system_prompt.txt'), 'utf8');
        }

        // Load products from Google Sheets (single source of truth)
        const sheetsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'products-from-sheets.json'), 'utf8'));
        products = sheetsData.products || [];

        lastProductLoadTime = new Date().toISOString();
        console.log(`✅ Loaded ${products.length} products from Google Sheets`);
        console.log('✅ System prompt loaded successfully');

        return {
            success: true,
            message: 'Product data loaded successfully',
            productsCount: products.length,
            timestamp: lastProductLoadTime
        };

    } catch (error) {
        console.error('❌ Error loading product data:', error.message);
        return {
            success: false,
            message: error.message,
            productsCount: 0
        };
    }
}

/**
 * Reload product data without server restart
 */
function reloadProductData() {
    console.log('\n🔄 Reloading product data...');
    const result = loadProductData();
    if (result.success) {
        console.log(`✅ Product data reloaded: ${result.productsCount} products`);
    } else {
        console.error(`❌ Failed to reload: ${result.message}`);
    }
    return result;
}

/**
 * Get product data status
 */
function getProductDataStatus() {
    return {
        lastLoadTime: lastProductLoadTime,
        totalProducts: products.length
    };
}

// Initial load on startup
loadProductData();

/**
 * Find relevant products based on user message
 */
function findRelevantProducts(userMessage) {
    const lowerMessage = userMessage.toLowerCase();

    // Keywords to ignore (common words, locations, time-related)
    const ignoreWords = [
        'need', 'want', 'looking', 'for', 'the', 'and', 'with', 'can', 'you', 'please',
        'bangalore', 'bengaluru', 'delhi', 'mumbai', 'chennai', 'hyderabad',
        'today', 'tomorrow', 'urgent', 'asap', 'fast', 'quick'
    ];

    // Extract meaningful search words
    const searchWords = lowerMessage
        .split(/\s+/)
        .filter(w => w.length > 2 && !ignoreWords.includes(w));

    // Find matching products
    const matchedProducts = products.filter(product => {
        const title = (product.title || '').toLowerCase();
        const category = (product.category || '').toLowerCase();
        const customLabel1 = (product.customLabel1 || '').toLowerCase();
        const description = (product.description || '').toLowerCase();

        // Check if any search word matches product data
        return searchWords.some(word =>
            title.includes(word) ||
            category.includes(word) ||
            customLabel1.includes(word) ||
            description.includes(word)
        );
    });

    return matchedProducts;
}

/**
 * Build dynamic prompt based on user message
 */
function buildPrompt(userMessage, currentDate, currentPricing = '', sessionContext = null) {
    // Find relevant products
    const relevantProducts = findRelevantProducts(userMessage);

    // Same-day delivery products
    const sameDayDeliveryProducts = [
        'Business Cards',
        'Document Printing',
        'Photo Prints',
        'Lamination',
        'Binding Services'
    ];

    // FAQ content
    const faqContent = `
Common FAQs:
- Payment: We accept cash, cards, UPI, and net banking
- Delivery: Standard delivery 3-5 days, express available for select products
- Design: Free design assistance available, or upload your own
- Quality: Premium quality guaranteed, reprint if not satisfied
- Bulk Orders: Special discounts available for bulk orders
    `.trim();

    // Build base prompt
    let prompt = systemPrompt
        .replace('${currentDate}', currentDate)
        .replace('{same_day_delivery_list}', sameDayDeliveryProducts.map(p => `• ${p}`).join('\n'))
        .replace('[FAQ_CONTENT]', faqContent);

    // Add product context if found
    if (relevantProducts.length > 0) {
        prompt += '\n\n[PRODUCT CONTEXT]\n';
        prompt += `Found ${relevantProducts.length} matching products:\n\n`;

        // Group products by customLabel1 (category)
        const grouped = {};
        relevantProducts.forEach(product => {
            const category = product.customLabel1 || product.category || 'Other';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(product);
        });

        // Display grouped products (limit 5 per category, max 3 categories)
        const categories = Object.keys(grouped).slice(0, 3);

        categories.forEach(category => {
            const categoryProducts = grouped[category].slice(0, 5);
            prompt += `📦 ${category} (${grouped[category].length} options):\n`;

            categoryProducts.forEach(product => {
                const price = typeof product.price === 'number'
                    ? `₹${product.price.toFixed(2)}`
                    : product.priceDisplay || 'Price on request';

                prompt += `\n• ${product.title}\n`;
                prompt += `  Price: ${price}\n`;

                if (product.description) {
                    // Truncate long descriptions
                    const shortDesc = product.description.length > 150
                        ? product.description.substring(0, 150) + '...'
                        : product.description;
                    prompt += `  Details: ${shortDesc}\n`;
                }

                if (product.shippingLabel) {
                    prompt += `  Delivery: ${product.shippingLabel}\n`;
                }

                if (product.link) {
                    const trackedLink = addUTMTracking(product.link, product.title || category);
                    prompt += `  Order: ${trackedLink}\n`;
                }
            });

            if (grouped[category].length > 5) {
                prompt += `\n  ... and ${grouped[category].length - 5} more options\n`;
            }
            prompt += '\n';
        });

        if (Object.keys(grouped).length > 3) {
            prompt += `\n... and more products in ${Object.keys(grouped).length - 3} other categories\n`;
        }
    }

    // Add dynamic pricing if available
    if (currentPricing) {
        prompt += `\n[CURRENT PRICING]\n${currentPricing}\n`;
    }

    // Add session context
    if (sessionContext) {
        prompt += '\n[SESSION CONTEXT]\n';

        if (sessionContext.productInterest) {
            prompt += `Customer interested in: ${sessionContext.productInterest}\n`;
        }

        if (sessionContext.questionsAsked && sessionContext.questionsAsked.length > 0) {
            prompt += `Questions asked: ${sessionContext.questionsAsked.join(', ')}\n`;
        }

        if (sessionContext.requirements && Object.keys(sessionContext.requirements).length > 0) {
            prompt += 'Requirements:\n';
            Object.entries(sessionContext.requirements).forEach(([key, value]) => {
                prompt += `- ${key}: ${value}\n`;
            });
        }
    }

    return prompt;
}

module.exports = {
    buildPrompt,
    reloadProductData,
    getProductDataStatus
};
