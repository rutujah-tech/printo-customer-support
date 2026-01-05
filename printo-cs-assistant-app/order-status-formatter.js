/**
 * Order Status Formatter
 * Formats PIA order data for WhatsApp display
 * Implements approved strategy: Show 3 orders at a time with navigation
 */

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format date to human-friendly format
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} - "Dec 27", "Tomorrow", "Today", etc.
 */
function formatDate(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Reset time parts for accurate comparison
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    // Check if today
    if (date.getTime() === today.getTime()) {
        return 'Today';
    }

    // Check if tomorrow
    if (date.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
    }

    // Check if within a week
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 7) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
    }

    // Format as "Dec 27"
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Check if order is delayed
 * @param {Object} order - Order object
 * @returns {boolean}
 */
function isDelayed(order) {
    if (!order.estimatedDelivery) return false;

    const today = new Date();
    const estimatedDate = new Date(order.estimatedDelivery);

    today.setHours(0, 0, 0, 0);
    estimatedDate.setHours(0, 0, 0, 0);

    // Delayed if estimated delivery is in the past and not delivered
    return estimatedDate < today &&
           order.status !== 'Delivered' &&
           order.statusId !== 8000;
}

// ============================================
// STATUS ICONS & EMOJIS
// ============================================

/**
 * Get status prefix for order status
 * @param {Object} order - Order object
 * @returns {string}
 */
function getStatusIcon(order) {
    // No icons - just return empty string for clean text
    return '';
}

// ============================================
// SUMMARY FORMATTING (For Multiple Orders)
// ============================================

/**
 * Create summary view for multiple orders
 * @param {Array} orders - Array of order objects
 * @returns {string} - Formatted summary
 */
function formatOrdersSummary(orders) {
    if (!orders || orders.length === 0) {
        return 'No orders found.';
    }

    const count = orders.length;

    // Count by major status categories
    let shipping = 0;
    let ready = 0;
    let inProduction = 0;
    let delivered = 0;
    let cancelled = 0;

    orders.forEach(order => {
        const statusId = order.statusId;

        if (statusId >= 8000) {
            if (statusId === 8000) delivered++;
            else if (statusId === 8010) cancelled++;
        } else if (statusId >= 7000) {
            shipping++;
        } else if (statusId >= 5000) {
            ready++;
        } else {
            inProduction++;
        }
    });

    let summary = `I found ${count} order${count > 1 ? 's' : ''}.\n\n`;

    if (shipping > 0) summary += `${shipping} shipping\n`;
    if (ready > 0) summary += `${ready} ready\n`;
    if (inProduction > 0) summary += `${inProduction} in production\n`;
    if (delivered > 0) summary += `${delivered} delivered\n`;
    if (cancelled > 0) summary += `${cancelled} cancelled\n`;

    return summary.trim();
}

// ============================================
// PAGINATED LIST (3 at a time)
// ============================================

/**
 * Format paginated order list (3 orders at a time)
 * @param {Array} orders - Array of order objects
 * @param {number} page - Page number (0-indexed)
 * @param {number} pageSize - Orders per page (default 3)
 * @returns {Object} - { text, hasMore, currentPage, totalPages }
 */
function formatOrdersPage(orders, page = 0, pageSize = 3) {
    if (!orders || orders.length === 0) {
        return {
            text: 'No orders found.',
            hasMore: false,
            currentPage: 0,
            totalPages: 0
        };
    }

    const totalOrders = orders.length;
    const totalPages = Math.ceil(totalOrders / pageSize);
    const startIdx = page * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalOrders);
    const pageOrders = orders.slice(startIdx, endIdx);

    let text = `Orders ${startIdx + 1}-${endIdx} (of ${totalOrders}):\n\n`;

    pageOrders.forEach((order, idx) => {
        const orderNum = startIdx + idx + 1;
        const icon = getStatusIcon(order);
        const deliveryDate = formatDate(order.estimatedDelivery);
        const delayed = isDelayed(order);

        text += `${orderNum}. ${order.orderId}\n`;
        text += `   ${icon} ${order.status}\n`;
        text += `   Due: ${deliveryDate}`;

        if (delayed) {
            text += ` ⚠️ Delayed`;
        }

        text += `\n\n`;
    });

    const hasNext = endIdx < totalOrders;
    const hasPrev = page > 0;

    if (hasNext || hasPrev) {
        text += `Type number to view details, or:\n`;
        if (hasPrev) text += `"Previous" for previous orders\n`;
        if (hasNext) text += `"Next" for next ${Math.min(pageSize, totalOrders - endIdx)} orders`;
    } else {
        text += `Type order number to view full details.`;
    }

    return {
        text: text.trim(),
        hasMore: hasNext,
        hasPrev: hasPrev,
        currentPage: page,
        totalPages: totalPages
    };
}

// ============================================
// SINGLE ORDER DETAILS
// ============================================

/**
 * Format single order full details
 * @param {Object} order - Order object
 * @returns {string} - Formatted details
 */
function formatOrderDetails(order) {
    if (!order) {
        return 'Order not found.';
    }

    const icon = getStatusIcon(order);
    const orderDate = formatDate(order.orderDate);
    const deliveryDate = formatDate(order.estimatedDelivery);
    const delayed = isDelayed(order);

    let details = `📦 ORDER DETAILS\n\n`;
    details += `Order: ${order.orderId}\n`;

    if (order.altId) {
        details += `Reference: ${order.altId}\n`;
    }

    details += `\n`;
    details += `${icon} Status: ${order.status}\n`;
    details += `Placed: ${orderDate}\n`;
    details += `Expected: ${deliveryDate}\n`;

    if (delayed) {
        details += `\nDELAYED\n`;
        details += `We apologize for the delay. Our team is working on this.\n`;
    } else if (order.statusId >= 7000 && order.statusId < 8000) {
        details += `\nOn the way!\n`;
    } else if (order.statusId === 8000) {
        details += `\nDelivered successfully!\n`;
    } else if (order.statusId === 8010) {
        details += `\nThis order was cancelled.\n`;
        if (order.status.includes('Error') || order.status.includes('Issue')) {
            details += `Reason: ${order.status}\n`;
        }
    } else {
        details += `\n✓ Everything is on track!\n`;
    }

    return details.trim();
}

// ============================================
// NO ORDERS FOUND MESSAGE
// ============================================

/**
 * Format message when no orders are found
 * @param {string} mobile - Mobile number that was searched
 * @returns {string}
 */
function formatNoOrdersFound(mobile) {
    return `I couldn't find any orders for mobile number ${mobile}.

Possible reasons:
• Order was placed with a different number
• Order is more than 6 months old
• Wrong number entered

Please check:
✓ Registered mobile number
✓ Order confirmation email

Need help? Contact support: 1800-XXX-XXXX`;
}

// ============================================
// ERROR MESSAGES
// ============================================

/**
 * Format error message
 * @param {string} errorType - Error type (TOKEN_EXPIRED, TIMEOUT, etc.)
 * @returns {string}
 */
function formatErrorMessage(errorType) {
    switch (errorType) {
        case 'TOKEN_EXPIRED':
            return 'Session expired. Please try again in a moment.';

        case 'TIMEOUT':
            return 'Request timed out. Please try again.';

        case 'SERVER_ERROR':
            return `I'm having trouble accessing order details right now. Please try again in a few minutes.

If urgent, contact support:
📞 1800-XXX-XXXX
📧 support@printo.in`;

        default:
            return `Unable to fetch order status. Please try again.

If the issue persists:
📞 Contact support: 1800-XXX-XXXX`;
    }
}

// ============================================
// MAIN FORMATTING FUNCTION
// ============================================

/**
 * Main function to format orders based on count
 * @param {Array} orders - Array of orders
 * @param {number} page - Current page (for pagination)
 * @returns {string} - Formatted message for WhatsApp
 */
function formatOrdersForWhatsApp(orders, page = 0) {
    if (!orders || orders.length === 0) {
        return formatNoOrdersFound('the provided number');
    }

    // Single order: Show full details
    if (orders.length === 1) {
        return formatOrderDetails(orders[0]);
    }

    // 2-3 orders: Show summary + all orders
    if (orders.length <= 3) {
        const summary = formatOrdersSummary(orders);
        const list = formatOrdersPage(orders, 0, orders.length);
        return `${summary}\n\n${list.text}`;
    }

    // 4+ orders: Show summary + paginated (3 at a time)
    const summary = formatOrdersSummary(orders);
    const paginatedList = formatOrdersPage(orders, page, 3);
    return `${summary}\n\n${paginatedList.text}`;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    formatOrdersForWhatsApp,
    formatOrderDetails,
    formatOrdersSummary,
    formatOrdersPage,
    formatNoOrdersFound,
    formatErrorMessage,
    formatDate,
    isDelayed,
    getStatusIcon
};

// ============================================
// USAGE EXAMPLES
// ============================================

/*
const { formatOrdersForWhatsApp, formatOrderDetails } = require('./order-status-formatter');

// Example 1: Format multiple orders
const orders = [
    { orderId: 'WEBKA/512088', status: 'Quality Check', statusId: 5000, orderDate: '2025-12-26', estimatedDelivery: '2025-12-27' },
    { orderId: 'WEBKA/512046', status: 'File Preparation', statusId: 2000, orderDate: '2025-12-26', estimatedDelivery: '2025-12-30' },
    // ... more orders
];

const message = formatOrdersForWhatsApp(orders, 0); // page 0
console.log(message);

// Example 2: Format single order
const order = orders[0];
const details = formatOrderDetails(order);
console.log(details);
*/
