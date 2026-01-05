/**
 * UTM Tracking Utility for WhatsApp Bot
 * Adds tracking parameters to product URLs for Google Analytics
 *
 * User Requirements:
 * - utm_source=whatsapp
 * - utm_medium=bot
 * - utm_campaign=whatsapp_sales
 * - utm_content=[product_name]
 * - Environment variable toggle (ENABLE_UTM)
 * - Fallback to original URLs if any error occurs
 */

require('dotenv').config();

/**
 * Add UTM tracking parameters to a product URL
 * @param {string} url - Original product URL
 * @param {string} productName - Product name for utm_content parameter
 * @returns {string} - URL with UTM parameters or original URL on error
 */
function addUTMTracking(url, productName = '') {
    try {
        // Check if UTM tracking is enabled
        const isUTMEnabled = process.env.ENABLE_UTM === 'true';

        if (!isUTMEnabled) {
            return url; // Return original URL if UTM is disabled
        }

        // Validate input URL
        if (!url || typeof url !== 'string') {
            console.warn('⚠️  Invalid URL provided to UTM tracker, using original');
            return url || '';
        }

        // Parse the URL
        const urlObj = new URL(url);

        // Prepare UTM parameters as requested by user
        const utmParams = {
            utm_source: 'whatsapp',
            utm_medium: 'bot',
            utm_campaign: 'whatsapp_sales',
            utm_content: productName ? sanitizeProductName(productName) : 'product'
        };

        // Add UTM parameters to URL
        Object.keys(utmParams).forEach(key => {
            urlObj.searchParams.set(key, utmParams[key]);
        });

        return urlObj.toString();

    } catch (error) {
        // Fallback: return original URL if any error occurs
        console.warn('⚠️  UTM tracking error, using original URL:', error.message);
        return url;
    }
}

/**
 * Sanitize product name for use in utm_content parameter
 * @param {string} productName - Raw product name
 * @returns {string} - Sanitized product name
 */
function sanitizeProductName(productName) {
    return productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
        .replace(/^_+|_+$/g, '')     // Remove leading/trailing underscores
        .substring(0, 50);            // Limit to 50 characters
}

/**
 * Process all URLs in bot response and add UTM tracking
 * @param {string} responseText - Bot response text with URLs
 * @param {string} productName - Product name for tracking
 * @returns {string} - Response text with UTM-tracked URLs
 */
function addUTMToResponse(responseText, productName = '') {
    if (!responseText) return responseText;

    try {
        // Check if UTM tracking is enabled
        const isUTMEnabled = process.env.ENABLE_UTM === 'true';

        if (!isUTMEnabled) {
            return responseText; // Return original response if UTM is disabled
        }

        // Find all printo.in URLs in the response
        const urlRegex = /(https?:\/\/printo\.in[^\s\)]*)/gi;

        return responseText.replace(urlRegex, (url) => {
            // Extract product name from URL if not provided
            const category = productName || extractProductNameFromURL(url);
            return addUTMTracking(url, category);
        });
    } catch (error) {
        console.warn('⚠️  Error adding UTM to response, using original:', error.message);
        return responseText;
    }
}

/**
 * Extract product/category name from URL for utm_content
 * @param {string} url - Product URL
 * @returns {string} - Product category name
 */
function extractProductNameFromURL(url) {
    if (!url) return 'general';

    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);

        // Extract category from URL path
        // e.g., https://printo.in/categories/business-cards → 'business-cards'
        if (pathParts.includes('categories') && pathParts[pathParts.indexOf('categories') + 1]) {
            return pathParts[pathParts.indexOf('categories') + 1];
        }

        // e.g., https://printo.in/products/custom-tshirt → 'custom-tshirt'
        if (pathParts.includes('products') && pathParts[pathParts.indexOf('products') + 1]) {
            return pathParts[pathParts.indexOf('products') + 1];
        }

        return 'general';
    } catch (error) {
        return 'general';
    }
}

/**
 * Batch process multiple product objects and add UTM tracking to their URLs
 * @param {Array} products - Array of product objects with 'link' property
 * @returns {Array} - Products with UTM-tracked URLs
 */
function addUTMToProducts(products) {
    if (!Array.isArray(products)) {
        console.warn('⚠️  Invalid products array provided to UTM tracker');
        return products;
    }

    return products.map(product => {
        if (product.link) {
            return {
                ...product,
                link: addUTMTracking(product.link, product.name || ''),
                originalLink: product.link // Preserve original link as backup
            };
        }
        return product;
    });
}

/**
 * Check if UTM tracking is enabled
 * @returns {boolean}
 */
function isUTMEnabled() {
    return process.env.ENABLE_UTM === 'true';
}

module.exports = {
    addUTMTracking,
    addUTMToResponse,
    addUTMToProducts,
    extractProductNameFromURL,
    isUTMEnabled,
    sanitizeProductName
};
