/**
 * Simplified UTM Builder Module
 *
 * SAFETY FIRST DESIGN:
 * - Completely optional module that can be disabled without breaking anything
 * - Always returns original URLs if disabled or on any error
 * - Only 4 UTM parameters (no complex tracking)
 * - Minimal code, maximum safety
 *
 * USAGE:
 * const utmBuilder = require('./utm-builder');
 *
 * // Start disabled by default
 * const trackedURL = utmBuilder.addUTM(originalURL, productName);
 *
 * // To enable:
 * utmBuilder.enable();
 *
 * // To disable (instantly restores original behavior):
 * utmBuilder.disable();
 */

class UTMBuilder {
    constructor() {
        // DISABLED BY DEFAULT - bot works normally
        this.enabled = false;

        // Simple product category patterns
        this.categoryPatterns = {
            'business_cards': ['business card', 'visiting card', '/business-cards'],
            'flyers': ['flyer', 'flier', '/flyers'],
            'wedding_inv': ['wedding', 'invitation', 'invite', '/invitations'],
            'banners': ['banner', 'standee', '/banners'],
            'photo_prints': ['photo print', 'picture print', 'print photo', '/photo-prints'],
            'binding': ['binding', 'book binding', '/binding'],
            'stickers': ['sticker', 'label', '/stickers'],
            'brochures': ['brochure', 'pamphlet', '/brochures'],
            'posters': ['poster', '/posters'],
            'tshirts': ['tshirt', 't-shirt', 'tee shirt', '/t-shirts'],
            'mugs': ['mug', 'coffee mug', '/mugs'],
            'notebooks': ['notebook', 'diary', '/notebooks']
        };
    }

    /**
     * Enable UTM tracking
     */
    enable() {
        this.enabled = true;
        console.log('✅ UTM tracking ENABLED');
    }

    /**
     * Disable UTM tracking (restores original behavior instantly)
     */
    disable() {
        this.enabled = false;
        console.log('❌ UTM tracking DISABLED - bot returns original URLs');
    }

    /**
     * Check if UTM is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Detect product category from product name or URL
     *
     * @param {string} productName - Product name from context
     * @param {string} productURL - Product URL
     * @returns {string} - Category name for utm_content
     */
    detectProductCategory(productName = '', productURL = '') {
        try {
            // Combine both for better matching
            const searchText = `${productName} ${productURL}`.toLowerCase();

            // Try to match against patterns
            for (const [category, patterns] of Object.entries(this.categoryPatterns)) {
                for (const pattern of patterns) {
                    if (searchText.includes(pattern)) {
                        return category;
                    }
                }
            }

            // Fallback to 'other' if no match
            return 'other';
        } catch (error) {
            console.error('Error detecting product category:', error);
            return 'other'; // Safe fallback
        }
    }

    /**
     * Add UTM parameters to a single URL
     *
     * @param {string} url - Original printo.in URL
     * @param {string} productName - Product name for category detection
     * @returns {string} - URL with UTM parameters (or original URL if disabled/error)
     */
    buildUTMURL(url, productName = '') {
        // SAFETY: If disabled, return original URL immediately
        if (!this.enabled) {
            return url;
        }

        try {
            // Validate URL
            if (!url || typeof url !== 'string') {
                return url || '';
            }

            // Only add UTM to printo.in URLs
            if (!url.includes('printo.in')) {
                return url;
            }

            // Parse URL
            const urlObj = new URL(url);

            // SIMPLIFIED UTM: Only 4 parameters
            const utmParams = {
                utm_source: 'whatsapp',           // FIXED
                utm_medium: 'bot',                // FIXED
                utm_campaign: 'product_discovery', // FIXED
                utm_content: this.detectProductCategory(productName, url) // DYNAMIC
            };

            // Add UTM parameters
            Object.entries(utmParams).forEach(([key, value]) => {
                urlObj.searchParams.set(key, value);
            });

            return urlObj.toString();

        } catch (error) {
            // SAFETY: On any error, return original URL
            console.error('UTM builder error (returning original URL):', error.message);
            return url;
        }
    }

    /**
     * Process bot response and add UTM to all printo.in URLs
     *
     * @param {string} responseText - Bot's response text
     * @param {string} productName - Product name for category detection
     * @returns {string} - Response with UTM-tracked URLs (or original if disabled/error)
     */
    addUTM(responseText, productName = '') {
        // SAFETY: If disabled, return original response immediately
        if (!this.enabled) {
            return responseText;
        }

        try {
            // Validate input
            if (!responseText || typeof responseText !== 'string') {
                return responseText || '';
            }

            // Find all printo.in URLs in response
            const urlRegex = /(https?:\/\/printo\.in[^\s\)]*)/gi;

            // Replace each URL with UTM-tracked version
            const trackedResponse = responseText.replace(urlRegex, (url) => {
                return this.buildUTMURL(url, productName);
            });

            return trackedResponse;

        } catch (error) {
            // SAFETY: On any error, return original response
            console.error('UTM processing error (returning original response):', error.message);
            return responseText;
        }
    }

    /**
     * Get current UTM configuration for debugging
     */
    getConfig() {
        return {
            enabled: this.enabled,
            fixed_params: {
                utm_source: 'whatsapp',
                utm_medium: 'bot',
                utm_campaign: 'product_discovery'
            },
            dynamic_param: 'utm_content (auto-detected from product)',
            categories: Object.keys(this.categoryPatterns)
        };
    }
}

// Export singleton instance
const utmBuilder = new UTMBuilder();

module.exports = utmBuilder;
