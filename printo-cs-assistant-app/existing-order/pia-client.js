/**
 * PIA API Client - Existing Order Status System
 * Fetches order information from PIA using phone number
 */

const axios = require('axios');

class PIAClient {
    constructor() {
        this.apiUrl = process.env.PIA_API_URL || 'https://pia.printo.in/api/v1/legacy/chatbot/order-status/';
        this.bearerToken = process.env.PIA_BEARER_TOKEN;
        this.timeout = 10000; // 10 seconds

        if (!this.bearerToken) {
            console.warn('⚠️  PIA_BEARER_TOKEN not configured');
        }
    }

    /**
     * Fetch active orders for a given phone number
     * @param {string} phone - 10-digit phone number
     * @returns {Promise<Array>} - Array of active orders with job details
     */
    async getActiveOrders(phone) {
        try {
            console.log(`🔍 [PIA] Querying orders for phone: ${phone}`);

            const response = await axios.get(this.apiUrl, {
                headers: {
                    'Authorization': `Bearer ${this.bearerToken}`,
                    'Content-Type': 'application/json'
                },
                params: { mobile: phone },
                timeout: this.timeout
            });

            const { data, count, message } = response.data;

            // Handle no orders found
            if (!data || !Array.isArray(data) || data.length === 0) {
                console.log(`ℹ️  [PIA] No orders found for ${phone}`);
                return [];
            }

            console.log(`✅ [PIA] Found ${count || data.length} orders`);

            // Filter and format active orders
            const activeOrders = this.filterActiveOrders(data);
            console.log(`📦 [PIA] ${activeOrders.length} active orders`);

            return activeOrders;

        } catch (error) {
            console.error(`❌ [PIA] API error:`, error.message);

            // Handle specific errors
            if (error.response?.status === 401) {
                throw new Error('PIA_TOKEN_EXPIRED');
            }

            if (error.code === 'ECONNABORTED') {
                throw new Error('PIA_TIMEOUT');
            }

            throw new Error('PIA_API_ERROR');
        }
    }

    /**
     * Filter only active orders (not completed, cancelled, or inactive)
     * @param {Array} orders - Raw orders from PIA
     * @returns {Array} - Active orders with job details
     */
    filterActiveOrders(orders) {
        const activeOrders = [];

        // Status strings that indicate completed/cancelled orders
        const inactiveStatuses = [
            'Delivered',
            'Completed',
            'Cancelled',
            'Dispatched'
        ];

        // Status IDs that indicate completed/cancelled orders (if statusId is available)
        const inactiveStatusIds = [
            8000, // Delivered
            9000, // Completed
            9999, // Cancelled
        ];

        for (const order of orders) {
            // Skip if order status is inactive (check both string and ID)
            const isInactiveStatus = order.status && inactiveStatuses.some(
                inactive => order.status.toLowerCase().includes(inactive.toLowerCase())
            );
            const isInactiveStatusId = order.statusId && inactiveStatusIds.includes(order.statusId);

            if (isInactiveStatus || isInactiveStatusId) {
                continue;
            }

            // Process order items (if available)
            if (order.items && Array.isArray(order.items) && order.items.length > 0) {
                for (const item of order.items) {
                    // Skip inactive items
                    const itemInactiveStatus = item.status && inactiveStatuses.some(
                        inactive => item.status.toLowerCase().includes(inactive.toLowerCase())
                    );
                    const itemInactiveStatusId = item.statusId && inactiveStatusIds.includes(item.statusId);

                    if (itemInactiveStatus || itemInactiveStatusId) {
                        continue;
                    }

                    // Only add if altId exists (customers only have PJ numbers)
                    if (!order.altId) continue;

                    activeOrders.push({
                        jobId: order.altId,
                        status: item.status || order.status || 'Processing',
                        statusId: item.statusId || order.statusId || null,
                        productName: item.productName || 'Product',
                        quantity: item.quantity || 0,
                        promisedDate: item.promisedDate || order.customerPromisedTAT || order.estimatedDelivery || null,
                        orderDate: order.orderDate || null,
                        logisticsInitiated: order.logisticsInitiated || false,
                        trackingLink: order.trackingLink || null,
                        awb: order.awb || null
                    });
                }
            } else {
                // Only add if altId exists (customers only have PJ numbers)
                if (!order.altId) continue;

                activeOrders.push({
                    jobId: order.altId,
                    status: order.status || 'Processing',
                    statusId: order.statusId || null,
                    productName: 'Order',
                    quantity: 0,
                    promisedDate: order.customerPromisedTAT || order.estimatedDelivery || null,
                    orderDate: order.orderDate || null,
                    logisticsInitiated: order.logisticsInitiated || false,
                    trackingLink: order.trackingLink || null,
                    awb: order.awb || null
                });
            }
        }

        return activeOrders;
    }

    /**
     * Extract 10-digit phone number from various formats
     * @param {string} input - User input (may contain text, country code, etc.)
     * @returns {string|null} - Extracted 10-digit phone number or null
     */
    extractPhoneNumber(input) {
        if (!input) return null;

        // Remove all non-digit characters
        const digitsOnly = input.replace(/\D/g, '');

        // Try to find 10-digit phone starting with 6-9 (Indian mobile)
        const match = digitsOnly.match(/([6-9]\d{9})/);
        if (match) {
            return match[1];
        }

        // If starts with 91 (country code), extract next 10 digits
        if (digitsOnly.startsWith('91') && digitsOnly.length >= 12) {
            const phone = digitsOnly.substring(2, 12);
            if (/^[6-9]\d{9}$/.test(phone)) {
                return phone;
            }
        }

        return null;
    }
}

module.exports = new PIAClient();
