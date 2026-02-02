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

            // Build order data for GPT
            const orderData = activeOrders.map(order => ({
                jobId: order.jobId,
                status: order.status,
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
- Include Job ID(s) and current status
- If multiple orders, list them clearly
- Use *bold* for important details like Job IDs and status
- End with a helpful note if needed
- Do NOT add greetings or sign-offs
- Be direct and to the point

Example formats:
- Single order: "Your order *Job ID: WEBKA/12345* is currently in *Production* and will be ready by Jan 30th."
- Multiple orders: "You have 2 active orders:\n1. *Job ID: WEBKA/12345* - *In Production*\n2. *Job ID: WEBKA/12346* - *Quality Check*"`;

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
            return `Your order *${order.jobId}* is currently *${order.status}*.`;
        }

        let message = `You have ${activeOrders.length} active orders:\n`;
        activeOrders.slice(0, 5).forEach((order, index) => {
            message += `${index + 1}. *${order.jobId}* - *${order.status}*\n`;
        });

        return message.trim();
    }
}

module.exports = new MessageGenerator();
