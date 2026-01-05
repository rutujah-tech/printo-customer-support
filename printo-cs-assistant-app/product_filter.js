/**
 * INTELLIGENT PRODUCT FILTER
 *
 * Reduces products.json from 6,000 lines (66 categories) to ~15 most relevant products
 * Based on user query keywords, reducing AI prompt from 14K to 2-3K tokens
 *
 * Strategy:
 * 1. Analyze user message for keywords
 * 2. Match keywords to product groups
 * 3. Return only relevant products
 * 4. Always include "most popular" products as fallback
 */

/**
 * Comprehensive keyword mapping covering ALL product types
 * Each keyword maps to product keys from products.json
 */
const PRODUCT_KEYWORD_MAP = {
    // BUSINESS & CORPORATE
    'business card': ['businesscards'],
    'visiting card': ['businesscards'],
    'letterhead': ['letterheads'],
    'envelope': ['envelopes'],
    'stamp': ['rubberstamp'],
    'rubber stamp': ['rubberstamp'],
    'bill book': ['billbooks'],
    'invoice': ['billbooks'],
    'receipt book': ['billbooks'],

    // PRINTING & DOCUMENTS
    'print': ['documentprinting', 'photoprints'],
    'document': ['documentprinting'],
    'photocopy': ['documentprinting'],
    'xerox': ['documentprinting'],
    'a3': ['documentprinting'],
    'a4': ['documentprinting'],
    'binding': ['documentprinting'],
    'lamination': ['documentprinting'],

    // PHOTOS
    'photo': ['photoprints', 'photoframes', 'photobook', 'photoplaque'],
    'picture': ['photoprints', 'photoframes'],
    'passport photo': ['photoprints'],
    'passport': ['photoprints'],
    'photo frame': ['photoframes'],
    'frame': ['photoframes'],
    'photo book': ['photobook'],
    'photobook': ['photobook'],
    'album': ['photobook'],
    'collage': ['photoprints'],
    'polaroid': ['photoprints'],
    'retro print': ['photoprints'],

    // MARKETING MATERIALS
    'flyer': ['flyersandleaflets', 'foldedflyers'],
    'flyers': ['flyersandleaflets', 'foldedflyers'],
    'leaflet': ['flyersandleaflets'],
    'brochure': ['flyersandleaflets', 'booklets'],
    'pamphlet': ['flyersandleaflets'],
    'banner': ['signagesandbanners', 'rollupstandees'],
    'signage': ['signagesandbanners'],
    'standee': ['standees', 'rollupstandees'],
    'poster': ['posters'],
    'hoarding': ['signagesandbanners'],
    'billboard': ['signagesandbanners'],

    // BOOKS & PUBLICATIONS
    'booklet': ['booklets'],
    'magazine': ['booklets'],
    'catalog': ['booklets'],
    'catalogue': ['booklets'],
    'manual': ['booklets'],
    'brochure': ['booklets', 'flyersandleaflets'],

    // STATIONERY
    'notebook': ['notebooks'],
    'notebooks': ['notebooks'],
    'diary': ['calendarsanddiaries'],
    'diaries': ['calendarsanddiaries'],
    'case bound diary': ['casebounddiaries'],
    'wire o diary': ['wireodiaries'],
    'wiro diary': ['wireodiaries'],
    'notepad': ['notepads'],
    'calendar': ['deskcalendars', 'cards'],
    'calendars': ['deskcalendars', 'cards'],
    'calendar card': ['cards'],
    'calendar cards': ['cards'],
    'desk calendar': ['deskcalendars'],
    'wall calendar': ['cards'],
    'planner': ['casebounddiaries', 'organisers'],
    'organizer': ['organisers'],
    'organiser': ['organisers'],

    // APPAREL & MERCHANDISE
    'tshirt': ['tshirts'],
    't-shirt': ['tshirts'],
    'shirt': ['tshirts'],
    'polo': ['tshirts'],
    'hoodie': ['sweatshirtandhoodies'],
    'sweatshirt': ['sweatshirtandhoodies'],
    'jacket': ['sweatshirtandhoodies'],
    'cap': ['caps'],
    'hat': ['caps'],
    'apron': ['tshirts'], // Fallback to apparel
    'backpack': ['backpacks'],
    'backpacks': ['backpacks'],
    'laptop bag': ['backpacks'],
    'laptop sleeve': ['laptopsleeves', 'backpacks'],

    // PROMOTIONAL ITEMS
    'mug': ['mugs'],
    'coffee mug': ['mugs'],
    'photo mug': ['mugs'],
    'keychain': ['keychains'],
    'lanyard': ['lanyards'],
    'badge': ['buttonbadges', 'idcards'],
    'button badge': ['buttonbadges'],
    'id card': ['idcards'],
    'magnet': ['magnets'],
    'fridge magnet': ['magnets'],
    'coaster': ['coasters'],
    'pen': ['pens'],
    'bottle': ['sippersandbottles', 'drinkwares'],
    'sipper': ['sippersandbottles'],
    'drinkware': ['drinkwares'],

    // STICKERS & LABELS
    'sticker': ['stickersandlabels'],
    'label': ['stickersandlabels', 'labels'],
    'decal': ['decals'],
    'hang tag': ['hangtags'],

    // PACKAGING
    'box': ['shippingandflatmailerboxes', 'foodcakeboxes', 'pizzaboxes'],
    'mailer box': ['shippingandflatmailerboxes'],
    'shipping box': ['shippingandflatmailerboxes'],
    'courier box': ['shippingandflatmailerboxes'],
    'pizza box': ['pizzaboxes'],
    'cake box': ['foodcakeboxes'],
    'food box': ['foodcakeboxes'],
    'packaging': ['shippingandflatmailerboxes', 'foodcakeboxes'],
    'bag': ['totebag', 'paperbags', 'cottoncarrybags'],
    'tote bag': ['totebag'],
    'paper bag': ['paperbags'],
    'cotton bag': ['cottoncarrybags'],
    'carry bag': ['cottoncarrybags'],
    'poly bag': ['courierpolybag'],
    'pouch': ['paperpouches', 'standuppouches'],
    'tape': ['packingtape'],
    'packing tape': ['packingtape'],

    // INVITATIONS & CARDS
    'invitation': ['invitations'],
    'invite': ['invitations'],
    'wedding': ['invitations'],
    'wedding invitation': ['invitations'],
    'marriage': ['invitations'],
    'birthday invitation': ['invitations'],
    'greeting card': ['invitations', 'cards'],
    'card': ['cards', 'businesscards'],
    'thank you card': ['cards'],
    'save the date': ['cards'],

    // AWARDS & RECOGNITION
    'award': ['awards'],
    'trophy': ['awards'],
    'medal': ['medals'],
    'certificate': ['certificates'],
    'plaque': ['awards', 'photoplaque'],

    // GIFTING
    'gift': ['gifthampers'],
    'hamper': ['gifthampers'],
    'gift hamper': ['gifthampers'],
    'corporate gift': ['gifthampers'],

    // CANVAS & WALL ART
    'canvas': ['canvas'],
    'canvas print': ['canvas'],
    'wall art': ['canvas', 'acrylicprints'],
    'acrylic': ['acrylicprints'],
    'acrylic print': ['acrylicprints'],

    // MENU & RESTAURANT
    'menu': ['menucards'],
    'menu card': ['menucards'],
    'restaurant': ['menucards'],

    // MISCELLANEOUS
    'bookmark': ['bookmarks'],
    'dangler': ['danglers'],
    'wobbler': ['danglers'],
    'nameplate': ['nameplates'],
    'name plate': ['nameplates'],
    'door sign': ['nameplates']
};

/**
 * Most popular products - always included as fallback
 * These are the top 10 most commonly requested products
 */
const POPULAR_PRODUCTS = [
    'businesscards',
    'tshirts',
    'documentprinting',
    'photoprints',
    'flyersandleaflets',
    'invitations',
    'stickersandlabels',
    'mugs',
    'notebooks',
    'signagesandbanners'
];

/**
 * Filters products based on user message
 * @param {string} userMessage - User's query
 * @param {object} allProducts - Complete products.json object
 * @returns {object} - Filtered products object with only relevant products
 */
function filterRelevantProducts(userMessage, allProducts) {
    if (!userMessage || typeof userMessage !== 'string') {
        // No message, return popular products only
        return getPopularProducts(allProducts);
    }

    const lowerMessage = userMessage.toLowerCase();
    const matchedProductKeys = new Set();

    // Step 1: Find all matching product keys from keywords
    for (const [keyword, productKeys] of Object.entries(PRODUCT_KEYWORD_MAP)) {
        if (lowerMessage.includes(keyword)) {
            productKeys.forEach(key => matchedProductKeys.add(key));
        }
    }

    // Step 2: If no matches, add popular products
    if (matchedProductKeys.size === 0) {
        POPULAR_PRODUCTS.forEach(key => matchedProductKeys.add(key));
    }

    // Step 3: Always include top 3 popular products for context
    POPULAR_PRODUCTS.slice(0, 3).forEach(key => matchedProductKeys.add(key));

    // Step 4: Build filtered products object
    const filteredProducts = {};
    let count = 0;
    const MAX_PRODUCTS = 15; // Limit to 15 products

    for (const productKey of matchedProductKeys) {
        if (count >= MAX_PRODUCTS) break;

        if (allProducts[productKey]) {
            filteredProducts[productKey] = allProducts[productKey];
            count++;
        }
    }

    // Step 5: If we have less than 5 products, add more popular ones
    if (count < 5) {
        for (const popularKey of POPULAR_PRODUCTS) {
            if (count >= MAX_PRODUCTS) break;
            if (!filteredProducts[popularKey] && allProducts[popularKey]) {
                filteredProducts[popularKey] = allProducts[popularKey];
                count++;
            }
        }
    }

    return filteredProducts;
}

/**
 * Gets popular products as fallback
 * @param {object} allProducts - Complete products.json object
 * @returns {object} - Popular products object
 */
function getPopularProducts(allProducts) {
    const popularFiltered = {};

    POPULAR_PRODUCTS.forEach(key => {
        if (allProducts[key]) {
            popularFiltered[key] = allProducts[key];
        }
    });

    return popularFiltered;
}

/**
 * Analyzes filtering effectiveness
 * @param {string} userMessage - User's query
 * @param {object} allProducts - Complete products.json object
 * @returns {object} - Analysis stats
 */
function analyzeFiltering(userMessage, allProducts) {
    const filtered = filterRelevantProducts(userMessage, allProducts);

    const totalProducts = Object.keys(allProducts).length;
    const filteredCount = Object.keys(filtered).length;
    const reductionPercent = ((1 - filteredCount / totalProducts) * 100).toFixed(1);

    // Estimate token savings (rough calculation)
    const estimatedOriginalTokens = 14000; // Current state
    const estimatedFilteredTokens = Math.ceil((filteredCount / totalProducts) * estimatedOriginalTokens);
    const tokenSavings = estimatedOriginalTokens - estimatedFilteredTokens;

    return {
        totalProducts,
        filteredCount,
        reductionPercent,
        estimatedOriginalTokens,
        estimatedFilteredTokens,
        tokenSavings,
        filteredProductKeys: Object.keys(filtered)
    };
}

module.exports = {
    filterRelevantProducts,
    analyzeFiltering,
    PRODUCT_KEYWORD_MAP,
    POPULAR_PRODUCTS
};
