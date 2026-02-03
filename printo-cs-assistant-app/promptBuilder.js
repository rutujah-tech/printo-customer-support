const fs = require('fs');
const path = require('path');
const { addUTMTracking, isUTMEnabled } = require('./utm-tracker');

// Load static files once on startup
let systemPrompt = '';
let productsData = {};
let scrapedProducts = [];

try {
    // Try loading from system_prompt folder first, fallback to root
    try {
        systemPrompt = fs.readFileSync(path.join(__dirname, 'system_prompt', 'system_prompt.txt'), 'utf8');
    } catch {
        systemPrompt = fs.readFileSync(path.join(__dirname, 'system_prompt.txt'), 'utf8');
    }

    // Try loading products.json from system_prompt folder first, fallback to root
    try {
        productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'system_prompt', 'products.json'), 'utf8'));
    } catch {
        productsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8'));
    }

    // Load scraped products data
    try {
        const scrapedData = JSON.parse(fs.readFileSync(path.join(__dirname, 'scraped_products.json'), 'utf8'));
        scrapedProducts = scrapedData.products || [];
        console.log(`✅ Loaded ${scrapedProducts.length} scraped products`);
    } catch (error) {
        console.log('ℹ️ No scraped products found (this is optional)');
    }

    console.log('✅ System prompt loaded successfully');
} catch (error) {
    console.error('❌ Error loading prompt files:', error.message);
    console.error('Current directory:', __dirname);
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

    // Product keywords mapping - Maps user keywords to scraped product categories
    // This ensures the bot finds relevant products from scraped_products.json
    const productMap = {
        // Original products
        'business card': 'businessCards',
        'visiting card': 'businessCards',
        'tshirt': 'tshirts',
        't-shirt': 'tshirts',
        'polo': 'tshirts',
        'apparel': 'tshirts',
        'hoodie': 'hoodies',
        'jacket': 'jackets',
        'sticker': 'stickers',
        'stickr': 'stickers',  // common typo
        'stickerr': 'stickers',  // common typo
        'label': 'stickers',
        'decal': 'stickers',
        'letterhead': 'letterheads',
        'notepad': 'notepads',
        'booklet': 'booklets',
        'id card': 'idCards',
        'brochure': 'brochures',
        'flyer': 'brochures',
        'leaflet': 'brochures',
        'pamphlet': 'brochures',  // CRITICAL: common customer term
        'pamphlets': 'brochures',
        'flyers': 'brochures',
        'leaflets': 'brochures',
        'magazine': 'booklets',  // Synonym mapping
        'catalog': 'booklets',
        'catalogue': 'booklets',
        'print pics': 'photoPrints',  // Intent mapping
        'picture prints': 'photoPrints',
        'photo printing': 'photoPrints',
        'pics': 'photoPrints',
        'dangler': 'danglers',
        'stamp': 'stamps',
        'rubber stamp': 'stamps',
        'photo print': 'photoPrints',
        'photo': 'photoPrints',
        'passport photo': 'photoPrints',
        'photo frame': 'photoFrames',
        'frame': 'photoFrames',
        'mug': 'mugs',
        'photo mug': 'mugs',
        'magnet': 'magnets',
        'fridge magnet': 'magnets',
        'invitation': 'invitations',
        'invite': 'invitations',  // common short form
        'invites': 'invitations',
        'wedding invitation': 'invitations',
        'wedding invite': 'invitations',  // CRITICAL: very common
        'wedding': 'invitations',  // context clue for invitations
        'marriage invitation': 'invitations',
        'birthday invitation': 'invitations',
        'greeting card': 'invitations',
        'photo book': 'photoBooks',
        'photobook': 'photoBooks',
        'polaroid': 'photoPrints',
        'retro print': 'photoPrints',

        // New categories from sitemap (577 products)
        'name plate': 'namePlates',
        'nameplate': 'namePlates',
        'diary': 'diaries',
        'diaries': 'diaries',
        'notebook': 'notebooks',
        'desk': 'desktopItems',
        'desktop': 'desktopItems',
        'desk stand': 'desktopItems',
        'organizer': 'desktopItems',
        'organiser': 'desktopItems',
        'award': 'awards',
        'trophy': 'awards',
        'backpack': 'backpacks',
        'bag': 'bags',
        'banner': 'banners',
        'bill book': 'billBooks',
        'bookmark': 'bookmarks',
        'button badge': 'buttonBadges',
        'badge': 'buttonBadges',
        'canvas': 'canvas',
        'cap': 'caps',
        'hat': 'caps',
        'card': 'cards',
        'certificate': 'certificates',
        'coaster': 'coasters',
        'carry bag': 'carryBags',
        'poly bag': 'polyBags',
        'courier bag': 'courierBags',
        'drinkware': 'drinkwares',
        'bottle': 'drinkwares',
        'envelope': 'envelopes',
        'poster': 'posters',
        'standee': 'standees',  // roll-up banner / poster stand
        'stand': 'standees',
        'roll up': 'standees',
        'acrylic': 'acrylicPrints',
        'gift': 'giftHampers',
        'hamper': 'giftHampers',
        'calendar': 'calendars',
        'calendars': 'calendars',
        'wall calendar': 'calendars',
        'desk calendar': 'calendars',
        'desktop calendar': 'calendars',
        'table calendar': 'calendars',
        'framed calendar': 'calendars',
        'a3 calendar': 'calendars',
        '2026 calendar': 'calendars',
        'case bound diary': 'diaries',
        'case-bound diary': 'diaries',
        'wiro diary': 'diaries',

        // Employee & Corporate Kits
        'engagement kit': 'employeeEngagement',
        'employee engagement': 'employeeEngagement',
        'engagement kits': 'employeeEngagement',
        'employee kit': 'employeeEngagement',
        'joining kit': 'joiningKits',
        'employee joining kit': 'joiningKits',
        'welcome kit': 'joiningKits',
        'onboarding kit': 'joiningKits',
        'joining kits': 'joiningKits',

        // Promotional Items
        'mousepad': 'mousepads',
        'mouse pad': 'mousepads',
        'custom mousepad': 'mousepads',
        'printed mousepad': 'mousepads',
        'cap': 'caps',
        'caps': 'caps',
        'hat': 'caps',
        'custom cap': 'caps',
        'branded cap': 'caps',

        // Gift Hampers
        'new year hamper': 'newYearHampers',
        'new year gift': 'newYearHampers',
        'new year hampers': 'newYearHampers',

        // Packaging-related products
        'packaging box': 'packagingBoxes',
        'packaging': 'packagingBoxes',
        'mailer box': 'mailerBoxes',
        'mailer': 'mailerBoxes',
        'shipping box': 'mailerBoxes',
        'courier box': 'mailerBoxes',
        'pizza box': 'pizzaBoxes',
        'cake box': 'cakeBoxes',
        'food box': 'foodBoxes',
        'packing tape': 'packingTape',
        'tape': 'packingTape'
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

    // Helper function for fuzzy string matching (handles typos)
    function isSimilar(word1, word2) {
        if (word1.length < 3 || word2.length < 3) return false;

        // Exact match or contains
        if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) return true;

        // Check if one word starts with the other (min 4 chars)
        if (word1.length >= 4 && word2.length >= 4) {
            if (word1.startsWith(word2.substring(0, 4)) || word2.startsWith(word1.substring(0, 4))) {
                return true;
            }
        }

        // Levenshtein-like distance for typo tolerance
        // Allow 1-2 character differences based on length
        const minLen = Math.min(word1.length, word2.length);
        const maxDiff = minLen <= 5 ? 1 : 2;

        if (Math.abs(word1.length - word2.length) > maxDiff) return false;

        let differences = 0;
        for (let i = 0; i < minLen; i++) {
            if (word1[i] !== word2[i]) {
                differences++;
                if (differences > maxDiff) return false;
            }
        }
        differences += Math.abs(word1.length - word2.length);

        return differences <= maxDiff;
    }

    // Semantic category relationships (for intelligent matching)
    // Maps customer terms → related category words to find products
    const categoryRelations = {
        'packaging': ['box', 'mailer', 'shipping', 'tape', 'label', 'courier', 'poly'],
        'box': ['mailer', 'shipping', 'packaging', 'pizza', 'cake', 'food'],
        'print': ['photo', 'document', 'poster', 'canvas', 'acrylic'],
        'apparel': ['tshirt', 'shirt', 'polo', 'hoodie', 'cap', 'jacket'],
        'promotional': ['badge', 'keychain', 'lanyard', 'mug', 'bottle', 'drinkware'],
        // CRITICAL: pamphlet/brochure mapping to flyer/leaflet categories
        'pamphlet': ['flyer', 'leaflet', 'folded'],
        'pamphlets': ['flyer', 'leaflet', 'folded'],
        'brochure': ['flyer', 'leaflet', 'folded'],
        'brochures': ['flyer', 'leaflet', 'folded']
    };

    // Common location keywords to ignore in product matching
    // These appear in queries like "pamphlets for expo Indiranagar Bangalore"
    const locationKeywords = [
        'bangalore', 'bengaluru', 'delhi', 'mumbai', 'hyderabad', 'chennai', 'kolkata', 'pune',
        'indiranagar', 'koramangala', 'whitefield', 'jayanagar', 'hsr', 'btm', 'marathahalli',
        'nagar', 'road', 'layout', 'cross', 'main', 'area', 'sector', 'phase', 'stage',
        'today', 'tomorrow', 'urgent', 'asap', 'soon'  // time-related words
    ];

    // Find relevant scraped products - Enhanced matching with fuzzy search + semantic understanding
    const relevantScrapedProducts = scrapedProducts.filter(product => {
        const productName = product.name.toLowerCase();
        const productCategory = product.category.toLowerCase();

        // Extract meaningful words from user message
        // Ignore: common words, location keywords, and very short words
        const userWords = lowerMessage.split(/\s+/).filter(w =>
            w.length > 3 &&
            !['need', 'want', 'have', 'show', 'make', 'looking', 'for', 'the', 'and', 'with', 'your', 'our', 'from', 'this', 'that'].includes(w) &&
            !locationKeywords.includes(w)  // Filter out location names
        );

        // Direct category match (e.g., "name plates" matches category "Name Plates")
        if (lowerMessage.includes(productCategory)) {
            return true;
        }

        // Semantic matching: if user says "packaging", match categories with "box", "mailer", etc.
        for (const [semanticWord, relatedWords] of Object.entries(categoryRelations)) {
            if (lowerMessage.includes(semanticWord)) {
                // Check if product category contains any related words
                if (relatedWords.some(related => productCategory.includes(related))) {
                    return true;
                }
            }
        }

        // Check for partial category word matches
        // e.g., "diary" matches "Case Bound Diaries"
        const categoryWords = productCategory.split(/\s+/);
        for (const word of categoryWords) {
            if (word.length > 3 && lowerMessage.includes(word)) {
                return true;
            }

            // Fuzzy match for typos (e.g., "daries" matches "diaries")
            for (const userWord of userWords) {
                if (isSimilar(word, userWord)) {
                    return true;
                }
            }
        }

        // Check if user message mentions product name or parts of it
        if (lowerMessage.includes(productName)) {
            return true;
        }

        const productWords = productName.split(/\s+/);
        for (const productWord of productWords) {
            if (productWord.length > 4 && lowerMessage.includes(productWord)) {
                return true;
            }

            // Fuzzy match product name words
            for (const userWord of userWords) {
                if (isSimilar(productWord, userWord)) {
                    return true;
                }
            }
        }

        // Check against productMap keywords
        return Object.keys(productMap).some(keyword =>
            lowerMessage.includes(keyword) &&
            (productName.includes(keyword) || productCategory.includes(keyword))
        );
    });

    // Same-day delivery products list (to be customized by you)
    const sameDayDeliveryProducts = [
        'Business Cards',
        'Document Printing',
        'Photo Prints',
        'Lamination',
        'Binding Services'
        // Add more products that support same-day delivery
    ];

    // FAQ content placeholder (to be populated from scraped FAQs)
    const faqContent = `
Common FAQs:
- Payment: We accept cash, cards, UPI, and net banking
- Delivery: Standard delivery 3-5 days, express available for select products
- Design: Free design assistance available, or upload your own
- Quality: Premium quality guaranteed, reprint if not satisfied
- Bulk Orders: Special discounts available for bulk orders
(This will be replaced with actual FAQ content from printo.in)
    `.trim();

    // Build the complete prompt
    let prompt = systemPrompt
        .replace('${currentDate}', currentDate)
        .replace('{same_day_delivery_list}', sameDayDeliveryProducts.map(p => `• ${p}`).join('\n'))
        .replace('[FAQ_CONTENT]', faqContent);

    // Add product context if relevant products found
    if (relevantProducts.length > 0) {
        prompt += '\n\n[PRODUCT CONTEXT - Manual Catalog]\n';
        relevantProducts.forEach(product => {
            prompt += `${product.name}:\n`;

            // Add category browse link if available (with UTM tracking)
            if (product.categoryLink) {
                const trackedLink = addUTMTracking(product.categoryLink, product.name || 'product');
                prompt += `Browse all options: ${trackedLink}\n`;
            }

            // Handle new variants structure
            if (product.variants) {
                Object.entries(product.variants).forEach(([variantKey, variant]) => {
                    prompt += `\n${variant.name}:\n`;
                    prompt += `- Price: ${variant.price}\n`;
                    prompt += `- MOQ: ${variant.moq}\n`;
                    if (variant.description) {
                        prompt += `- Details: ${variant.description}\n`;
                    }
                    if (variant.link) {
                        const trackedVariantLink = addUTMTracking(variant.link, variant.name || product.name);
                        prompt += `- Order at: ${trackedVariantLink}\n`;
                    }
                });
            }
            // Handle old pricing structure (for backward compatibility)
            else if (product.pricing) {
                Object.entries(product.pricing).forEach(([variant, price]) => {
                    prompt += `- ${variant}: ${price}\n`;
                });
                if (product.deliveryTime) {
                    prompt += `- Delivery: ${product.deliveryTime}\n`;
                }
                if (product.minQuantity) {
                    prompt += `- Min quantity: ${product.minQuantity}\n`;
                }
            }
            prompt += '\n';
        });
    }

    // Add scraped products context if found
    if (relevantScrapedProducts.length > 0) {
        prompt += '\n\n[PRODUCT CONTEXT - Live Website Data]\n';
        prompt += `Found ${relevantScrapedProducts.length} products from printo.in:\n\n`;

        // Group scraped products by category
        const groupedByCategory = {};
        relevantScrapedProducts.forEach(product => {
            if (!groupedByCategory[product.category]) {
                groupedByCategory[product.category] = [];
            }
            groupedByCategory[product.category].push(product);
        });

        // Display grouped products
        Object.entries(groupedByCategory).forEach(([category, products]) => {
            prompt += `${category} (${products.length} options):\n`;

            // Show category link with UTM tracking
            if (products[0].categoryLink || products[0].url) {
                const categoryUrl = products[0].categoryLink || products[0].url;
                const trackedCategoryLink = addUTMTracking(categoryUrl, category);
                prompt += `Browse all: ${trackedCategoryLink}\n\n`;
            }

            // List products (limit to 10 per category to avoid overwhelming)
            products.slice(0, 10).forEach(product => {
                prompt += `- ${product.name}\n`;
                prompt += `  Price: ${product.price}\n`;
                if (product.link || product.url) {
                    const productUrl = product.link || product.url;
                    const trackedProductLink = addUTMTracking(productUrl, product.name);
                    prompt += `  Order: ${trackedProductLink}\n`;
                }
            });

            if (products.length > 10) {
                prompt += `\n... and ${products.length - 10} more options\n`;
            }
            prompt += '\n';
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