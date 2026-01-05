/**
 * PIA API Client
 * Handles communication with PIA (Printo Internal Admin) system for order status
 */

const axios = require('axios');

// ============================================
// CONFIGURATION
// ============================================

class PIAClient {
    constructor() {
        this.config = {
            apiUrl: process.env.PIA_API_URL || 'https://beta-pia.printo.in/api/v1/legacy/chatbot/order-status/',
            authUrl: process.env.PIA_AUTH_URL || 'https://beta-pia.printo.in/api/v1/auth/',
            bearerToken: process.env.PIA_BEARER_TOKEN,
            username: process.env.PIA_USERNAME,
            password: process.env.PIA_PASSWORD,
            timeout: 10000 // 10 seconds
        };

        // Validate required config
        if (!this.config.bearerToken) {
            console.warn('⚠️  PIA_BEARER_TOKEN not set in environment variables');
        }
    }

    // ============================================
    // MAIN API METHODS
    // ============================================

    /**
     * Search for orders by mobile number
     * @param {string} mobile - 10-digit mobile number
     * @returns {Promise<Object>} - { success, orders, count, error }
     */
    async searchByMobile(mobile) {
        try {
            console.log(`🔍 Searching PIA for mobile: ${mobile}`);

            const response = await axios.get(this.config.apiUrl, {
                headers: {
                    'Authorization': `Bearer ${this.config.bearerToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    mobile: mobile
                },
                timeout: this.config.timeout
            });

            // PIA returns: { success: true, data: [...], count: N }
            // OR: { success: true, data: null, message: "No active orders found..." }
            const { data, count, message } = response.data;

            // Handle "no orders found" case (data is null)
            if (data === null) {
                console.log(`ℹ️  No orders found: ${message}`);
                return {
                    success: true,
                    orders: [],
                    count: 0,
                    error: null,
                    message: message || 'No orders found'
                };
            }

            // Validate data is an array
            if (!Array.isArray(data)) {
                console.error('❌ PIA API returned unexpected format');
                return {
                    success: false,
                    orders: [],
                    count: 0,
                    error: 'Invalid response format from PIA'
                };
            }

            console.log(`✅ Found ${count || data.length} orders`);

            return {
                success: true,
                orders: data,
                count: count || data.length,
                error: null
            };

        } catch (error) {
            return this.handleError(error, mobile);
        }
    }

    /**
     * Search for orders by email
     * @param {string} email - Customer email
     * @returns {Promise<Object>} - { success, orders, count, error }
     */
    async searchByEmail(email) {
        try {
            console.log(`🔍 Searching PIA for email: ${email}`);

            const response = await axios.get(this.config.apiUrl, {
                headers: {
                    'Authorization': `Bearer ${this.config.bearerToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    email: email
                },
                timeout: this.config.timeout
            });

            const { data, count, message } = response.data;

            // Handle "no orders found" case (data is null)
            if (data === null) {
                console.log(`ℹ️  No orders found: ${message}`);
                return {
                    success: true,
                    orders: [],
                    count: 0,
                    error: null,
                    message: message || 'No orders found'
                };
            }

            // Validate data is an array
            if (!Array.isArray(data)) {
                console.error('❌ PIA API returned unexpected format');
                return {
                    success: false,
                    orders: [],
                    count: 0,
                    error: 'Invalid response format from PIA'
                };
            }

            console.log(`✅ Found ${count || data.length} orders`);

            return {
                success: true,
                orders: data,
                count: count || data.length,
                error: null
            };

        } catch (error) {
            return this.handleError(error, email);
        }
    }

    /**
     * Get details for a specific order by ID
     * @param {string} orderId - Order ID (e.g., "WEBKA/512088")
     * @param {string} mobile - Mobile number to search
     * @returns {Promise<Object>} - { success, order, error }
     */
    async getOrderById(orderId, mobile) {
        try {
            // First get all orders for this mobile
            const result = await this.searchByMobile(mobile);

            if (!result.success || result.orders.length === 0) {
                return {
                    success: false,
                    order: null,
                    error: 'No orders found for this mobile number'
                };
            }

            // Find the specific order
            const order = result.orders.find(o => o.orderId === orderId);

            if (!order) {
                return {
                    success: false,
                    order: null,
                    error: `Order ${orderId} not found`
                };
            }

            return {
                success: true,
                order: order,
                error: null
            };

        } catch (error) {
            return {
                success: false,
                order: null,
                error: error.message
            };
        }
    }

    // ============================================
    // AUTHENTICATION & TOKEN MANAGEMENT
    // ============================================

    /**
     * Refresh the bearer token
     * @returns {Promise<string>} - New bearer token
     */
    async refreshToken() {
        try {
            console.log('🔄 Refreshing PIA bearer token...');

            const response = await axios.post(this.config.authUrl, {
                username: this.config.username,
                password: this.config.password
            }, {
                timeout: this.config.timeout
            });

            const newToken = response.data.access;

            if (!newToken) {
                throw new Error('No access token in response');
            }

            // Update the token
            this.config.bearerToken = newToken;
            console.log('✅ Token refreshed successfully');

            return newToken;

        } catch (error) {
            console.error('❌ Token refresh failed:', error.message);
            throw error;
        }
    }

    /**
     * Verify if current token is valid
     * @returns {Promise<boolean>}
     */
    async verifyToken() {
        try {
            // Try a simple API call to verify token
            const response = await axios.get(this.config.apiUrl, {
                headers: {
                    'Authorization': `Bearer ${this.config.bearerToken}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    mobile: '0000000000' // Dummy mobile
                },
                timeout: this.config.timeout
            });

            // If we get any response (even 404), token is valid
            return true;

        } catch (error) {
            // 401 = token expired/invalid
            if (error.response && error.response.status === 401) {
                return false;
            }
            // Other errors don't necessarily mean token is invalid
            return true;
        }
    }

    // ============================================
    // ERROR HANDLING
    // ============================================

    /**
     * Handle API errors
     * @param {Error} error - Error object
     * @param {string} identifier - Mobile/email that was searched
     * @returns {Object} - Error response
     */
    handleError(error, identifier) {
        console.error(`❌ PIA API error for ${identifier}:`, error.message);

        // Token expired
        if (error.response && error.response.status === 401) {
            return {
                success: false,
                orders: [],
                count: 0,
                error: 'TOKEN_EXPIRED',
                message: 'Authentication token expired. Please try again.'
            };
        }

        // No orders found (404)
        if (error.response && error.response.status === 404) {
            return {
                success: true,
                orders: [],
                count: 0,
                error: null,
                message: 'No orders found'
            };
        }

        // Network timeout
        if (error.code === 'ECONNABORTED') {
            return {
                success: false,
                orders: [],
                count: 0,
                error: 'TIMEOUT',
                message: 'Request timed out. Please try again.'
            };
        }

        // Server error (500+)
        if (error.response && error.response.status >= 500) {
            return {
                success: false,
                orders: [],
                count: 0,
                error: 'SERVER_ERROR',
                message: 'PIA system is temporarily unavailable. Please try again later.'
            };
        }

        // Generic error
        return {
            success: false,
            orders: [],
            count: 0,
            error: 'UNKNOWN_ERROR',
            message: 'Unable to fetch order status. Please try again or contact support.'
        };
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    /**
     * Check if order is delayed
     * @param {Object} order - Order object from PIA
     * @returns {boolean}
     */
    isOrderDelayed(order) {
        if (!order.estimatedDelivery) return false;

        const today = new Date();
        const estimatedDate = new Date(order.estimatedDelivery);

        // If estimated delivery is in the past and order is not delivered
        return estimatedDate < today &&
               order.status !== 'Delivered' &&
               order.statusId !== 8000;
    }

    /**
     * Get orders sorted by most recent first
     * @param {Array} orders - Array of orders
     * @returns {Array} - Sorted orders
     */
    sortOrdersByRecent(orders) {
        return orders.sort((a, b) => {
            const dateA = new Date(a.orderDate);
            const dateB = new Date(b.orderDate);
            return dateB - dateA; // Most recent first
        });
    }

    /**
     * Filter active orders (not cancelled, not delivered)
     * @param {Array} orders - Array of orders
     * @returns {Array} - Active orders
     */
    getActiveOrders(orders) {
        return orders.filter(order => {
            return order.statusId !== 8000 && // Not delivered
                   order.statusId !== 8010;   // Not cancelled
        });
    }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

const piaClient = new PIAClient();

// ============================================
// EXPORTED FUNCTIONS (Simple API)
// ============================================

/**
 * Search orders by mobile number (simple wrapper)
 * @param {string} mobile - 10-digit mobile number
 * @returns {Promise<Object>}
 */
async function getOrdersByMobile(mobile) {
    return await piaClient.searchByMobile(mobile);
}

/**
 * Search orders by email (simple wrapper)
 * @param {string} email - Email address
 * @returns {Promise<Object>}
 */
async function getOrdersByEmail(email) {
    return await piaClient.searchByEmail(email);
}

/**
 * Get specific order details (simple wrapper)
 * @param {string} orderId - Order ID
 * @param {string} mobile - Mobile number
 * @returns {Promise<Object>}
 */
async function getOrderDetails(orderId, mobile) {
    return await piaClient.getOrderById(orderId, mobile);
}

/**
 * Refresh authentication token (simple wrapper)
 * @returns {Promise<string>}
 */
async function refreshAuthToken() {
    return await piaClient.refreshToken();
}

// Export both the class and simple functions
module.exports = {
    PIAClient,
    piaClient,
    getOrdersByMobile,
    getOrdersByEmail,
    getOrderDetails,
    refreshAuthToken
};

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// Example 1: Get orders by mobile
const { getOrdersByMobile } = require('./pia-api-client');

const result = await getOrdersByMobile('9582226884');
if (result.success) {
    console.log(`Found ${result.count} orders`);
    result.orders.forEach(order => {
        console.log(`Order ${order.orderId}: ${order.status}`);
    });
} else {
    console.log(`Error: ${result.message}`);
}

// Example 2: Get specific order details
const { getOrderDetails } = require('./pia-api-client');

const order = await getOrderDetails('WEBKA/512088', '9582226884');
if (order.success) {
    console.log(`Order ${order.order.orderId}`);
    console.log(`Status: ${order.order.status}`);
    console.log(`Expected: ${order.order.estimatedDelivery}`);
}

// Example 3: Using the class instance directly
const { piaClient } = require('./pia-api-client');

const result = await piaClient.searchByMobile('9582226884');
const activeOrders = piaClient.getActiveOrders(result.orders);
const sortedOrders = piaClient.sortOrdersByRecent(activeOrders);
*/
