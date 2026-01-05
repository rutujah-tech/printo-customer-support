const axios = require('axios');

/**
 * BotSpace API Service
 * Handles all interactions with BotSpace WhatsApp API
 */
class BotSpaceService {
    constructor() {
        this.baseURL = process.env.BOTSPACE_API_URL || 'https://api.bot.space/v1';
        this.channelId = process.env.BOTSPACE_CHANNEL_ID;
        this.apiKey = process.env.BOTSPACE_API_KEY;

        // Validate required configuration
        if (!this.channelId || !this.apiKey) {
            console.warn('⚠️  BotSpace credentials not configured. Set BOTSPACE_CHANNEL_ID and BOTSPACE_API_KEY in .env');
        }

        // Configure axios instance with default headers
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });

        // Add request interceptor for logging
        this.client.interceptors.request.use(
            config => {
                console.log(`📤 BotSpace API Request: ${config.method?.toUpperCase()} ${config.url}`);
                return config;
            },
            error => {
                console.error('📤 BotSpace Request Error:', error.message);
                return Promise.reject(error);
            }
        );

        // Add response interceptor for logging
        this.client.interceptors.response.use(
            response => {
                console.log(`📥 BotSpace API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            error => {
                console.error('📥 BotSpace Response Error:', error.response?.status, error.response?.data || error.message);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Send a text message to a customer via WhatsApp
     * @param {string} phone - Customer phone number (with country code)
     * @param {string} message - Message text to send
     * @param {object} options - Additional options (conversationId, etc.)
     * @returns {Promise<object>} BotSpace API response
     */
    async sendMessage(phone, message, options = {}) {
        try {
            const payload = {
                phone: phone,
                message: message,
                ...options
            };

            const response = await this.client.post(
                `/${this.channelId}/message/send-message`,
                payload
            );

            console.log(`✅ Message sent to ${phone}`);
            return response.data;

        } catch (error) {
            console.error(`❌ Failed to send message to ${phone}:`, error.message);
            throw this._handleError(error, 'sendMessage');
        }
    }

    /**
     * Send a session message (for ongoing conversations)
     * @param {string} conversationId - BotSpace conversation ID
     * @param {string} message - Message text to send
     * @param {object} options - Additional options
     * @returns {Promise<object>} BotSpace API response
     */
    async sendSessionMessage(conversationId, message, options = {}) {
        try {
            const payload = {
                conversationId: conversationId,
                message: message,
                ...options
            };

            const response = await this.client.post(
                `/${this.channelId}/message/send-session-message`,
                payload
            );

            console.log(`✅ Session message sent to conversation ${conversationId}`);
            return response.data;

        } catch (error) {
            console.error(`❌ Failed to send session message:`, error.message);
            throw this._handleError(error, 'sendSessionMessage');
        }
    }

    /**
     * Send media message (images, PDFs, etc.)
     * @param {string} conversationId - BotSpace conversation ID
     * @param {string} mediaUrl - URL to media file
     * @param {string} caption - Optional caption
     * @param {string} mediaType - Type of media (image, document, etc.)
     * @returns {Promise<object>} BotSpace API response
     */
    async sendMediaMessage(conversationId, mediaUrl, caption = '', mediaType = 'document') {
        try {
            const payload = {
                conversationId: conversationId,
                mediaUrl: mediaUrl,
                caption: caption,
                mediaType: mediaType
            };

            const response = await this.client.post(
                `/${this.channelId}/message/send-session-media-message`,
                payload
            );

            console.log(`✅ Media message sent to conversation ${conversationId}`);
            return response.data;

        } catch (error) {
            console.error(`❌ Failed to send media message:`, error.message);
            throw this._handleError(error, 'sendMediaMessage');
        }
    }

    /**
     * Get conversation details
     * @param {string} conversationId - BotSpace conversation ID
     * @returns {Promise<object>} Conversation data
     */
    async getConversation(conversationId) {
        try {
            const response = await this.client.get(
                `/${this.channelId}/conversation/${conversationId}`
            );

            return response.data;

        } catch (error) {
            console.error(`❌ Failed to get conversation:`, error.message);
            throw this._handleError(error, 'getConversation');
        }
    }

    /**
     * Get all conversations (with optional filtering)
     * @param {object} filters - Filter parameters (status, assignmentType, etc.)
     * @returns {Promise<object>} List of conversations
     */
    async getConversations(filters = {}) {
        try {
            const response = await this.client.get(
                `/${this.channelId}/conversation`,
                { params: filters }
            );

            return response.data;

        } catch (error) {
            console.error(`❌ Failed to get conversations:`, error.message);
            throw this._handleError(error, 'getConversations');
        }
    }

    /**
     * Create a new conversation
     * @param {object} conversationData - Conversation details
     * @returns {Promise<object>} Created conversation data
     */
    async createConversation(conversationData) {
        try {
            const response = await this.client.post(
                `/${this.channelId}/conversation`,
                conversationData
            );

            console.log(`✅ Conversation created`);
            return response.data;

        } catch (error) {
            console.error(`❌ Failed to create conversation:`, error.message);
            throw this._handleError(error, 'createConversation');
        }
    }

    /**
     * Get message delivery status
     * @param {string} messageId - BotSpace message ID
     * @returns {Promise<object>} Delivery status
     */
    async getMessageStatus(messageId) {
        try {
            const response = await this.client.get(
                `/${this.channelId}/message/${messageId}/delivery-status`
            );

            return response.data;

        } catch (error) {
            console.error(`❌ Failed to get message status:`, error.message);
            throw this._handleError(error, 'getMessageStatus');
        }
    }

    /**
     * Send a message with retry logic
     * @param {string} phone - Customer phone number
     * @param {string} message - Message text
     * @param {number} maxRetries - Maximum retry attempts (default: 3)
     * @returns {Promise<object>} BotSpace API response
     */
    async sendMessageWithRetry(phone, message, maxRetries = 3) {
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.sendMessage(phone, message);
            } catch (error) {
                lastError = error;
                console.warn(`⚠️  Retry ${attempt}/${maxRetries} for message to ${phone}`);

                // Exponential backoff: wait 1s, 2s, 4s
                if (attempt < maxRetries) {
                    await this._sleep(Math.pow(2, attempt - 1) * 1000);
                }
            }
        }

        throw lastError;
    }

    /**
     * Handle and format API errors
     * @private
     */
    _handleError(error, method) {
        const errorData = {
            method: method,
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
        };

        // Check for specific error types
        if (error.response) {
            switch (error.response.status) {
                case 401:
                    errorData.type = 'AUTHENTICATION_ERROR';
                    errorData.message = 'Invalid BotSpace API key';
                    break;
                case 403:
                    errorData.type = 'PERMISSION_ERROR';
                    errorData.message = 'No permission to access this resource';
                    break;
                case 404:
                    errorData.type = 'NOT_FOUND';
                    errorData.message = 'Resource not found';
                    break;
                case 429:
                    errorData.type = 'RATE_LIMIT';
                    errorData.message = 'Rate limit exceeded';
                    break;
                case 500:
                    errorData.type = 'SERVER_ERROR';
                    errorData.message = 'BotSpace server error';
                    break;
                default:
                    errorData.type = 'API_ERROR';
            }
        } else if (error.code === 'ECONNABORTED') {
            errorData.type = 'TIMEOUT';
            errorData.message = 'Request timeout';
        } else {
            errorData.type = 'NETWORK_ERROR';
        }

        return errorData;
    }

    /**
     * Sleep helper for retry logic
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if BotSpace is configured
     * @returns {boolean}
     */
    isConfigured() {
        return !!(this.channelId && this.apiKey);
    }
}

module.exports = BotSpaceService;
