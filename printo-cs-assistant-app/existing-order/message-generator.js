/**
 * GPT-Powered Status Message Generator
 * Generates customer-friendly status messages for existing orders
 */

const { OpenAI } = require('openai');

class MessageGenerator {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Internal statuses that should be displayed as "In Production" to customers
        // Using partial matches to handle variations (e.g., "Assigned Printing" vs "Assigned to Printing")
        this.productionStatusKeywords = [
            'pre-press',
            'prepress',
            'ready for os',
            'qc',
            'quality',
            'packing',
            'outsourced',
            'vendor',
            'printing',
            'postpress',
            'post press',
            'post-press'
        ];
    }

    /**
     * Map internal status to customer-friendly status
     * Centralizes status display logic - does not modify stored values
     * @param {string} status - Internal status from PIA
     * @returns {string} - Customer-friendly status
     */
    mapStatusForDisplay(status) {
        if (!status) return 'Processing';

        const normalizedStatus = status.toLowerCase().trim();

        // Check if status contains any production-related keyword
        const isProduction = this.productionStatusKeywords.some(keyword =>
            normalizedStatus.includes(keyword)
        );

        if (isProduction) {
            return 'In Production';
        }

        return status;
    }

    /**
     * Generate customer-friendly status message for active orders
     * @param {Array} activeOrders - Array of active orders from PIA
     * @param {string} phone - Customer's phone number
     * @returns {Promise<string>} - GPT-generated status message
     */
    async generateStatusMessage(activeOrders, phone) {
        try {
            console.log(`🤖 [GPT] Generating status message for ${activeOrders.length} orders`);

            // Handle no active orders case
            if (!activeOrders || activeOrders.length === 0) {
                return this.getNoActiveOrdersMessage(phone);
            }

            // Build order data for GPT (apply status mapping for display)
            const orderData = activeOrders.map(order => ({
                jobId: order.jobId,
                status: this.mapStatusForDisplay(order.status),
                product: order.productName,
                quantity: order.quantity,
                promisedDate: order.promisedDate
            }));

            // Create GPT prompt
            const systemPrompt = `You are a customer service assistant for Printo, a printing company. Your job is to inform customers about their existing order status in a clear, friendly, and concise manner.

Guidelines:
- Be warm, professional, and helpful
- Use simple, easy-to-understand language
- Keep the message SHORT (2-4 sentences max)
- Include Order ID(s) and current status
- If multiple orders, list them clearly
- Use *bold* for important details like Order IDs and status
- End with a helpful note if needed
- Do NOT add greetings or sign-offs
- Be direct and to the point
- IMPORTANT: Use "Order ID" (not "Job ID") - customers know their PJ order numbers

Example formats:
- Single order: "Your order *PJ123456* is currently in *Production* and will be ready by Jan 30th."
- Multiple orders: "You have 2 active orders:\n1. *PJ123456* - *In Production*\n2. *PJ123457* - *Quality Check*"`;

            const userPrompt = `Generate a status message for the following order(s):

${JSON.stringify(orderData, null, 2)}

Create a short, customer-friendly message that clearly communicates the order status.`;

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                max_tokens: 200,
                temperature: 0.3
            });

            const message = completion.choices[0].message.content.trim();
            console.log(`✅ [GPT] Message generated successfully`);

            return message;

        } catch (error) {
            console.error(`❌ [GPT] Error generating message:`, error.message);

            // Fallback to simple message if GPT fails
            return this.getFallbackMessage(activeOrders);
        }
    }

    /**
     * Generate message when no active orders found
     * @param {string} phone - Customer's phone number
     * @returns {string} - No orders message
     */
    getNoActiveOrdersMessage(phone) {
        return `We couldn't find any active orders for the phone number *${phone}*.

If you recently placed an order, it may take a few minutes to reflect in our system. For assistance, please call us at *9513734374*.`;
    }

    /**
     * Fallback message if GPT fails
     * @param {Array} activeOrders - Active orders
     * @returns {string} - Simple status message
     */
    getFallbackMessage(activeOrders) {
        if (activeOrders.length === 1) {
            const order = activeOrders[0];
            const displayStatus = this.mapStatusForDisplay(order.status);
            return `Your order *${order.jobId}* is currently *${displayStatus}*.`;
        }

        let message = `You have ${activeOrders.length} active orders:\n`;
        activeOrders.slice(0, 5).forEach((order, index) => {
            const displayStatus = this.mapStatusForDisplay(order.status);
            message += `${index + 1}. *${order.jobId}* - *${displayStatus}*\n`;
        });

        return message.trim();
    }
}

module.exports = new MessageGenerator();
