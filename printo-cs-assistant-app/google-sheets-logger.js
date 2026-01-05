const { google } = require('googleapis');
require('dotenv').config();

class GoogleSheetsLogger {
    constructor() {
        this.sheetId = process.env.GOOGLE_SHEET_ID;
        this.serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        this.privateKey = process.env.GOOGLE_PRIVATE_KEY;

        if (!this.sheetId || !this.serviceAccountEmail || !this.privateKey) {
            console.warn('⚠️  Google Sheets credentials not fully configured. Logging will be disabled.');
            this.enabled = false;
            return;
        }

        try {
            // Handle private key format - AWS might send it with literal \n or actual newlines
            let formattedPrivateKey = this.privateKey;

            // If it's a string with escaped newlines, replace them
            if (formattedPrivateKey.includes('\\n')) {
                formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');
            }

            // Remove any quotes that might have been added
            formattedPrivateKey = formattedPrivateKey.replace(/^["']|["']$/g, '');

            console.log('🔑 Private key format check:', {
                hasBackslashN: this.privateKey.includes('\\n'),
                hasActualNewline: this.privateKey.includes('\n'),
                startsWithBegin: formattedPrivateKey.startsWith('-----BEGIN'),
                length: formattedPrivateKey.length
            });

            // Initialize Google Sheets API client
            this.auth = new google.auth.JWT(
                this.serviceAccountEmail,
                null,
                formattedPrivateKey,
                ['https://www.googleapis.com/auth/spreadsheets']
            );

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            this.enabled = true;
            console.log('✅ Google Sheets Logger initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Google Sheets Logger:', error.message);
            console.error('Error stack:', error.stack);
            this.enabled = false;
        }
    }

    /**
     * Test connection to Google Sheets
     */
    async testConnection() {
        if (!this.enabled) {
            console.log('⚠️  Google Sheets logging is disabled');
            return false;
        }

        try {
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.sheetId
            });

            console.log(`✅ Successfully connected to Google Sheet: "${response.data.properties.title}"`);
            return true;
        } catch (error) {
            console.error('❌ Google Sheets connection test failed:', error.message);
            this.enabled = false;
            return false;
        }
    }

    /**
     * Log conversation data to Google Sheets
     * @param {Object} data - The conversation data to log
     * @param {string} data.sessionId - Session ID
     * @param {string} data.userInput - User's message
     * @param {string} data.botResponse - Bot's response
     * @param {string} data.product - Detected product (optional)
     * @param {string} data.pincode - Detected pincode (optional)
     * @param {string} data.status - Status of the request (success/error)
     * @param {number} data.responseTime - Response time in milliseconds
     */
    async logConversation(data) {
        if (!this.enabled) {
            return; // Silently skip if logging is disabled
        }

        try {
            const timestamp = new Date().toISOString();
            const {
                sessionId = 'N/A',
                userInput = '',
                botResponse = '',
                product = 'N/A',
                pincode = 'N/A',
                status = 'success',
                responseTime = 0
            } = data;

            // Prepare row data
            const values = [[
                timestamp,
                sessionId,
                userInput.substring(0, 500), // Limit to 500 chars
                botResponse.substring(0, 500), // Limit to 500 chars
                product,
                pincode,
                status,
                responseTime
            ]];

            // Append to sheet
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.sheetId,
                range: 'Sheet1!A:H',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: values
                }
            });

            console.log(`📝 Logged conversation to Google Sheets [${sessionId}]`);
        } catch (error) {
            console.error('❌ Failed to log to Google Sheets:', error.message);
            // Don't throw error - we don't want logging failures to break the app
        }
    }

    /**
     * Initialize sheet with headers if needed
     */
    async initializeHeaders() {
        if (!this.enabled) {
            return;
        }

        try {
            // Check if sheet has data
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.sheetId,
                range: 'Sheet1!A1:H1'
            });

            // If no data or empty, add headers
            if (!response.data.values || response.data.values.length === 0) {
                const headers = [[
                    'Timestamp',
                    'Session ID',
                    'User Input',
                    'Bot Response',
                    'Product',
                    'Pincode',
                    'Status',
                    'Response Time (ms)'
                ]];

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.sheetId,
                    range: 'Sheet1!A1:H1',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: headers
                    }
                });

                console.log('📋 Initialized Google Sheet headers');
            }
        } catch (error) {
            console.error('Failed to initialize headers:', error.message);
        }
    }
}

module.exports = GoogleSheetsLogger;
