/**
 * Phone Number Extractor for BotSpace Integration
 * Extracts and validates Indian mobile numbers from customer responses
 */

/**
 * Extract phone number from text sent by BotSpace
 * @param {string} text - Customer's response from BotSpace (may contain phone in sentence)
 * @returns {object} - { success: boolean, phone: string|null, error: string|null }
 */
function extractPhoneNumber(text) {
    if (!text || typeof text !== 'string') {
        return {
            success: false,
            phone: null,
            error: 'No text provided'
        };
    }

    // Remove all non-digit characters to find potential phone numbers
    const digitsOnly = text.replace(/\D/g, '');

    let foundNumbers = [];

    // First priority: Check if entire text (digits only) is exactly 10 digits
    if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
        return {
            success: true,
            phone: digitsOnly,
            error: null
        };
    }

    // Second priority: Check if 12 digits with 91 country code
    if (digitsOnly.length === 12 && /^91[6-9]\d{9}$/.test(digitsOnly)) {
        return {
            success: true,
            phone: digitsOnly.substring(2),
            error: null
        };
    }

    // Third priority: Search for patterns in text
    // Look for 12-digit with country code first (to handle +918641493433)
    const countryCodePattern = /91[6-9]\d{9}(?!\d)/g;
    const ccMatches = digitsOnly.match(countryCodePattern);
    if (ccMatches && ccMatches.length > 0) {
        // Take first match and remove country code
        return {
            success: true,
            phone: ccMatches[0].substring(2),
            error: null
        };
    }

    // Fourth priority: Look for 10-digit Indian mobile (not part of longer number)
    // Use word boundaries in original text to avoid matching parts of longer numbers
    const mobilePattern = /(?:^|\D)([6-9]\d{9})(?:\D|$)/;
    const match = text.match(mobilePattern);
    if (match && match[1]) {
        const phone = match[1];
        // Verify it's not part of a longer number
        const phoneInDigitsOnly = digitsOnly.indexOf(phone);
        if (phoneInDigitsOnly !== -1) {
            // Check if there's a digit before or after in digitsOnly
            const hasDigitBefore = phoneInDigitsOnly > 0;
            const hasDigitAfter = phoneInDigitsOnly + 10 < digitsOnly.length;

            // If it's 91 before, that's ok (country code)
            if (hasDigitBefore) {
                const before = digitsOnly.substring(phoneInDigitsOnly - 2, phoneInDigitsOnly);
                if (before === '91') {
                    return {
                        success: true,
                        phone: phone,
                        error: null
                    };
                }
            }

            // If no digits before/after, it's clean
            if (!hasDigitBefore && !hasDigitAfter) {
                return {
                    success: true,
                    phone: phone,
                    error: null
                };
            }
        }
    }

    // Last resort: Find all 10-digit patterns and filter valid ones
    const allTenDigitPatterns = digitsOnly.match(/[6-9]\d{9}/g);
    if (allTenDigitPatterns && allTenDigitPatterns.length > 0) {
        const validNumbers = allTenDigitPatterns.filter(num => {
            return num.length === 10 && /^[6-9]\d{9}$/.test(num);
        });

        if (validNumbers.length > 0) {
            if (validNumbers.length > 1) {
                console.warn(`Multiple phone numbers found: ${validNumbers.join(', ')}. Using first one.`);
            }
            return {
                success: true,
                phone: validNumbers[0],
                error: null
            };
        }
    }

    // No valid number found
    return {
        success: false,
        phone: null,
        error: 'No valid Indian mobile number found. Please provide a 10-digit number starting with 6, 7, 8, or 9.'
    };
}

/**
 * Validate if a phone number is valid Indian mobile
 * @param {string} phone - Phone number to validate
 * @returns {boolean}
 */
function isValidIndianMobile(phone) {
    if (!phone || typeof phone !== 'string') {
        return false;
    }

    // Must be exactly 10 digits
    if (phone.length !== 10) {
        return false;
    }

    // Must start with 6, 7, 8, or 9
    if (!/^[6-9]/.test(phone)) {
        return false;
    }

    // Must be all digits
    if (!/^\d{10}$/.test(phone)) {
        return false;
    }

    return true;
}

/**
 * Format phone number for display (optional utility)
 * @param {string} phone - 10-digit phone number
 * @returns {string} - Formatted as XXX-XXX-XXXX
 */
function formatPhoneForDisplay(phone) {
    if (!phone || phone.length !== 10) {
        return phone;
    }

    return `${phone.substring(0, 3)}-${phone.substring(3, 6)}-${phone.substring(6)}`;
}

/**
 * Main function to use in server.js for BotSpace integration
 * @param {string} botspaceResponse - Full response text from BotSpace
 * @returns {string|null} - Cleaned 10-digit phone number or null if invalid
 */
function getPhoneFromBotspaceResponse(botspaceResponse) {
    const result = extractPhoneNumber(botspaceResponse);

    if (result.success) {
        console.log(`✅ Extracted phone number: ${result.phone}`);
        return result.phone;
    } else {
        console.log(`❌ Phone extraction failed: ${result.error}`);
        return null;
    }
}

// Export functions
module.exports = {
    extractPhoneNumber,
    isValidIndianMobile,
    formatPhoneForDisplay,
    getPhoneFromBotspaceResponse
};

// ============================================
// USAGE EXAMPLES
// ============================================

/*
// Example 1: BotSpace sends customer response with sentence
const response1 = "this is my number 8641493433";
const phone1 = getPhoneFromBotspaceResponse(response1);
console.log(phone1); // Output: "8641493433"

// Example 2: Just the number
const response2 = "9811552920";
const phone2 = getPhoneFromBotspaceResponse(response2);
console.log(phone2); // Output: "9811552920"

// Example 3: With country code
const response3 = "my number is +91 8641493433";
const phone3 = getPhoneFromBotspaceResponse(response3);
console.log(phone3); // Output: "8641493433"

// Example 4: With formatting
const response4 = "864-149-3433";
const phone4 = getPhoneFromBotspaceResponse(response4);
console.log(phone4); // Output: "8641493433"

// Example 5: Invalid number
const response5 = "my number is 123456";
const phone5 = getPhoneFromBotspaceResponse(response5);
console.log(phone5); // Output: null

// Example 6: Multiple sentences
const response6 = "I placed order from 8641493433 yesterday";
const phone6 = getPhoneFromBotspaceResponse(response6);
console.log(phone6); // Output: "8641493433"
*/
