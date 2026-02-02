/**
 * Existing Order Status Webhook
 * Handles incoming requests from Botspace for order status inquiries
 */

const express = require('express');
const router = express.Router();
const piaClient = require('./pia-client');
const messageGenerator = require('./message-generator');

/**
 * POST /api/existing-order/status
 * Main endpoint for order status inquiries
 *
 * Expected payload from Botspace:
 * {
 *   "phone": "9940117071",           // Customer phone number
 *   "message": "9940117071"          // OR raw message containing phone
 * }
 */
router.post('/existing-order/status', async (req, res) => {
    const startTime = Date.now();

    try {
        console.log('\n📞 [EXISTING ORDER] Request received:', JSON.stringify(req.body, null, 2));

        // Extract phone number from request
        const { phone, message } = req.body;
        let phoneNumber = phone;

        // If phone not directly provided, try to extract from message
        if (!phoneNumber && message) {
            phoneNumber = piaClient.extractPhoneNumber(message);
        }

        // Validate phone number
        if (!phoneNumber) {
            console.warn('⚠️  [EXISTING ORDER] No valid phone number found');
            return res.status(400).json({
                success: false,
                error: 'INVALID_PHONE',
                message: 'Please provide a valid 10-digit phone number.'
            });
        }

        console.log(`✅ [EXISTING ORDER] Phone number: ${phoneNumber}`);

        // Step 1: Query PIA for active orders
        let activeOrders;
        try {
            activeOrders = await piaClient.getActiveOrders(phoneNumber);
        } catch (piaError) {
            console.error(`❌ [EXISTING ORDER] PIA error:`, piaError.message);

            // Return user-friendly error
            return res.status(500).json({
                success: false,
                error: 'PIA_ERROR',
                message: 'Unable to fetch order status at the moment. Please try again or call 9513734374 for assistance.'
            });
        }

        // Step 2: Generate GPT-powered status message
        let statusMessage;
        try {
            statusMessage = await messageGenerator.generateStatusMessage(activeOrders, phoneNumber);
        } catch (gptError) {
            console.error(`❌ [EXISTING ORDER] GPT error:`, gptError.message);

            // Fallback to simple message
            statusMessage = messageGenerator.getFallbackMessage(activeOrders);
        }

        const responseTime = Date.now() - startTime;

        console.log(`✅ [EXISTING ORDER] Response generated in ${responseTime}ms`);
        console.log(`📤 [EXISTING ORDER] Message:`, statusMessage);

        // Return success response
        return res.json({
            success: true,
            message: statusMessage,
            metadata: {
                phone: phoneNumber,
                activeOrderCount: activeOrders.length,
                responseTime: responseTime,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        const responseTime = Date.now() - startTime;
        console.error(`❌ [EXISTING ORDER] Unexpected error:`, error);

        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'Something went wrong. Please try again or call 9513734374 for assistance.',
            responseTime: responseTime
        });
    }
});

/**
 * GET /api/existing-order/health
 * Health check endpoint
 */
router.get('/existing-order/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Existing Order Status System',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

module.exports = router;
