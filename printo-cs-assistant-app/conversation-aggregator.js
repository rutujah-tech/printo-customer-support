const { google } = require('googleapis');
require('dotenv').config();

/**
 * ConversationAggregator
 *
 * Transforms multi-row conversation logs from Sheet1 into single-row format in Sheet3
 *
 * Current Format (Sheet1):
 * timestamp | session_id | user_input | bot_response | product | pincode | status | response_time
 *
 * New Format (Sheet3):
 * session_id | start_time | msg1_user | msg1_bot | msg2_user | msg2_bot | ... | msgN_user | msgN_bot
 */
class ConversationAggregator {
    constructor() {
        this.sheetId = process.env.GOOGLE_SHEET_ID;
        this.serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        this.privateKey = process.env.GOOGLE_PRIVATE_KEY;

        if (!this.sheetId || !this.serviceAccountEmail || !this.privateKey) {
            console.warn('⚠️  Google Sheets credentials not configured');
            this.enabled = false;
            return;
        }

        try {
            // Format private key
            let formattedPrivateKey = this.privateKey;
            if (formattedPrivateKey.includes('\\n')) {
                formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, '\n');
            }
            formattedPrivateKey = formattedPrivateKey.replace(/^["']|["']$/g, '');

            // Initialize API client
            this.auth = new google.auth.JWT(
                this.serviceAccountEmail,
                null,
                formattedPrivateKey,
                ['https://www.googleapis.com/auth/spreadsheets']
            );

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            this.enabled = true;
            console.log('✅ Conversation Aggregator initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Conversation Aggregator:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Read all raw logs from Sheet1
     * @returns {Array} Array of conversation rows
     */
    async readRawLogs() {
        if (!this.enabled) return [];

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.sheetId,
                range: 'Sheet1!A:H' // Read all columns from Sheet1
            });

            const rows = response.data.values || [];

            // Skip header row if exists
            if (rows.length > 0 && rows[0][0] === 'Timestamp') {
                return rows.slice(1);
            }

            return rows;
        } catch (error) {
            console.error('❌ Failed to read raw logs:', error.message);
            return [];
        }
    }

    /**
     * Aggregate conversations by session_id
     * Converts: multiple rows per session → single row with message pairs
     *
     * Logic:
     * 1. Group all messages by session_id
     * 2. Sort by timestamp (chronological order)
     * 3. Pair customer messages with bot replies
     * 4. Create single row: [session_id, start_time, msg1_user, msg1_bot, msg2_user, msg2_bot, ...]
     *
     * @param {Array} rawLogs - Raw conversation rows from Sheet1
     * @returns {Object} { sessions: Map, maxMessagePairs: number }
     */
    aggregateBySession(rawLogs) {
        const sessions = new Map();
        let maxMessagePairs = 0;

        // Process each log entry
        for (const row of rawLogs) {
            if (!row || row.length < 4) continue; // Skip invalid rows

            const [timestamp, sessionId, userInput, botResponse] = row;

            if (!sessionId || sessionId === 'N/A') continue; // Skip invalid sessions

            // Initialize session if new
            if (!sessions.has(sessionId)) {
                sessions.set(sessionId, {
                    sessionId: sessionId,
                    startTime: timestamp,
                    messages: []
                });
            }

            const session = sessions.get(sessionId);

            // Add message pair (customer → bot)
            session.messages.push({
                timestamp: new Date(timestamp),
                userInput: userInput || '',
                botResponse: botResponse || ''
            });

            // Track maximum conversation length
            maxMessagePairs = Math.max(maxMessagePairs, session.messages.length);
        }

        // Sort messages within each session by timestamp
        for (const session of sessions.values()) {
            session.messages.sort((a, b) => a.timestamp - b.timestamp);
        }

        console.log(`📊 Aggregated ${sessions.size} sessions, max ${maxMessagePairs} message pairs`);

        return { sessions, maxMessagePairs };
    }

    /**
     * Generate dynamic headers for Sheet3
     * Format: session_id | start_time | msg1_user | msg1_bot | msg2_user | msg2_bot | ...
     *
     * @param {number} maxMessagePairs - Maximum number of message pairs
     * @returns {Array} Header row
     */
    generateHeaders(maxMessagePairs) {
        const headers = ['session_id', 'start_time'];

        for (let i = 1; i <= maxMessagePairs; i++) {
            headers.push(`msg${i}_customer`);
            headers.push(`msg${i}_bot`);
        }

        return headers;
    }

    /**
     * Convert aggregated sessions to rows for Sheet3
     * Each session becomes one row with message pairs spread across columns
     *
     * @param {Map} sessions - Aggregated sessions
     * @param {number} maxMessagePairs - Max message pairs for column count
     * @returns {Array} Rows ready for Sheet3
     */
    sessionsToRows(sessions, maxMessagePairs) {
        const rows = [];

        for (const session of sessions.values()) {
            const row = [
                session.sessionId,
                session.startTime
            ];

            // Add message pairs
            for (let i = 0; i < maxMessagePairs; i++) {
                if (i < session.messages.length) {
                    const msg = session.messages[i];
                    row.push(msg.userInput);
                    row.push(msg.botResponse);
                } else {
                    // Fill empty cells if this session has fewer messages
                    row.push('');
                    row.push('');
                }
            }

            rows.push(row);
        }

        return rows;
    }

    /**
     * Read existing data from Sheet3 to check for existing sessions
     * @returns {Set} Set of existing session IDs
     */
    async getExistingSessions() {
        if (!this.enabled) return new Set();

        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.sheetId,
                range: 'Sheet3!A:A' // Read only session_id column
            });

            const rows = response.data.values || [];
            const sessionIds = new Set();

            // Skip header
            for (let i = 1; i < rows.length; i++) {
                if (rows[i][0]) {
                    sessionIds.add(rows[i][0]);
                }
            }

            return sessionIds;
        } catch (error) {
            // Sheet3 might not exist yet, return empty set
            console.log('ℹ️  Sheet3 not found or empty, will create new');
            return new Set();
        }
    }

    /**
     * Write aggregated conversations to Sheet3
     * - ONLY appends NEW sessions (incremental mode)
     * - Does NOT overwrite existing data
     * - Dynamically adjusts column count if needed
     *
     * @param {Array} headers - Column headers
     * @param {Array} rows - Data rows
     * @param {boolean} incrementalMode - If true, only append new sessions (default: true)
     */
    async writeToSheet3(headers, rows, incrementalMode = true) {
        if (!this.enabled || rows.length === 0) return;

        try {
            if (incrementalMode) {
                // INCREMENTAL MODE: Only append new sessions
                const existingSessions = await this.getExistingSessions();

                // Filter out sessions that already exist in Sheet3
                const newRows = rows.filter(row => !existingSessions.has(row[0]));

                if (newRows.length === 0) {
                    console.log('ℹ️  No new conversations to add to Sheet3');
                    return;
                }

                // Check if Sheet3 has headers
                let needsHeader = false;
                try {
                    const response = await this.sheets.spreadsheets.values.get({
                        spreadsheetId: this.sheetId,
                        range: 'Sheet3!A1:B1'
                    });
                    needsHeader = !response.data.values || response.data.values.length === 0;
                } catch (error) {
                    needsHeader = true;
                }

                // Get current row count to append after
                let nextRow = 1;
                if (!needsHeader) {
                    const response = await this.sheets.spreadsheets.values.get({
                        spreadsheetId: this.sheetId,
                        range: 'Sheet3!A:A'
                    });
                    nextRow = (response.data.values || []).length + 1;
                }

                // Append data
                const dataToWrite = needsHeader ? [headers, ...newRows] : newRows;
                const startRange = needsHeader ? 'Sheet3!A1' : `Sheet3!A${nextRow}`;

                await this.sheets.spreadsheets.values.append({
                    spreadsheetId: this.sheetId,
                    range: startRange,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    requestBody: {
                        values: dataToWrite
                    }
                });

                console.log(`✅ Appended ${newRows.length} NEW conversations to Sheet3`);
            } else {
                // FULL REWRITE MODE: Clear and rewrite everything (old behavior)
                await this.sheets.spreadsheets.values.clear({
                    spreadsheetId: this.sheetId,
                    range: 'Sheet3!A:ZZ'
                });

                const allRows = [headers, ...rows];

                await this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.sheetId,
                    range: 'Sheet3!A1',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: allRows
                    }
                });

                console.log(`✅ Written ${rows.length} conversations to Sheet3 (full rewrite)`);
            }
        } catch (error) {
            console.error('❌ Failed to write to Sheet3:', error.message);
        }
    }

    /**
     * Main method: Process all conversations and update Sheet3
     *
     * Workflow:
     * 1. Read raw logs from Sheet1
     * 2. Aggregate by session_id
     * 3. Generate dynamic headers
     * 4. Convert to rows
     * 5. Write to Sheet3 (clears old data first)
     */
    async processConversations() {
        if (!this.enabled) {
            console.log('⚠️  Conversation aggregator is disabled');
            return;
        }

        console.log('🔄 Processing conversations...');

        try {
            // Step 1: Read raw logs
            const rawLogs = await this.readRawLogs();
            if (rawLogs.length === 0) {
                console.log('ℹ️  No conversations to process');
                return;
            }

            // Step 2: Aggregate by session
            const { sessions, maxMessagePairs } = this.aggregateBySession(rawLogs);

            // Step 3: Generate headers
            const headers = this.generateHeaders(maxMessagePairs);

            // Step 4: Convert to rows
            const rows = this.sessionsToRows(sessions, maxMessagePairs);

            // Step 5: Write to Sheet3
            await this.writeToSheet3(headers, rows);

            console.log('✅ Conversation processing complete!');
            console.log(`   Sessions: ${sessions.size}`);
            console.log(`   Max conversation length: ${maxMessagePairs} exchanges`);
        } catch (error) {
            console.error('❌ Failed to process conversations:', error.message);
            console.error(error.stack);
        }
    }
}

module.exports = ConversationAggregator;
