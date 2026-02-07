/**
 * WIZ Prompts Configuration
 *
 * Edit this file to customize AI behavior without touching the main code.
 * All prompts are exported as functions that accept dynamic parameters.
 */

/**
 * Sanitize input text to handle special characters
 * Only escape characters that break template literals
 * Quotes are safe - no need to escape them for AI prompts
 */
function sanitizeInput(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\\/g, '\\\\')     // Escape backslashes first
        .replace(/`/g, "'")          // Replace backticks with single quotes
        .replace(/\$/g, 'S')         // Replace dollar signs (breaks template literals)
        .replace(/\n/g, ' ')         // Replace newlines with spaces
        .replace(/\r/g, '')          // Remove carriage returns
        .replace(/\t/g, ' ')         // Replace tabs with spaces
        .trim();
    // Note: Quotes (" and ') are safe in template literals - don't escape them
}

/**
 * PROMPT 1: Parse Customer Data
 * Used to extract structured gift details from free-form customer messages
 *
 * @param {string} customerMessage - The raw message from customer
 * @returns {string} - The prompt to send to Gemini for parsing
 */
export function getParsingPrompt(customerMessage) {
    const safeMessage = sanitizeInput(customerMessage);
    return `Extract gift details from this customer message. Return ONLY valid JSON, no markdown.

Customer message: "${safeMessage}"

Extract and return JSON with these fields:
{
  "recipientName": "name of the person receiving the gift",
  "occasion": "the occasion/event ONLY if explicitly mentioned",
  "relationship": "relationship to recipient",
  "specialNotes": "any special details, interests, quirks, or personalization hints mentioned"
}

STRICT RULES:

1. recipientName:
   - Extract the NAME of who the gift is FOR
   - If user says "gift for myself" or "for me", use "Me" or the user's name if provided
   - If no name found, use "Friend"

2. occasion - BE STRICT, DO NOT GUESS:
   - ONLY use an occasion if EXPLICITLY mentioned (Birthday, Wedding, Anniversary, Valentine, Rakhi, etc.)
   - Age mentioned (like "87 yrs old") does NOT mean Birthday
   - Description of person does NOT imply any occasion
   - If NO occasion is clearly stated, use "Special Day"
   - Examples of what counts as explicit: "birthday", "getting married", "anniversary coming up"
   - Examples of what does NOT count: age, personality traits, hobbies, travel plans

3. relationship:
   - If user says "for myself" or "for me", use "Self"
   - Otherwise extract: Friend, Sister, Brother, Mother, Father, Dad, Mom, Wife, Husband, Girlfriend, Boyfriend, Colleague, etc.
   - If unclear, use "Friend"

4. specialNotes:
   - Include ALL context, traits, interests, quirks, and details from the message
   - This is the most important field - capture everything

EXAMPLES:

Input: "Gift for my friend Ankita. She is getting married soon. I want to tease her with her fiancee name ankur"
Output: {"recipientName": "Ankita", "occasion": "Wedding", "relationship": "Friend", "specialNotes": "Getting married soon, fiancee name is Ankur, wants to tease her"}
Input: "Gift for myself, I love coffee and books"
Output: {"recipientName": "Me", "occasion": "Special Day", "relationship": "Self", "specialNotes": "Loves coffee and books, self-gift"}

Return ONLY the JSON object, nothing else.`;
}


/**
 * PROMPT 2: Creative Gift Generation
 * Used to generate personalized gift copy and image mockup
 *
 * @param {Object} params - Gift parameters
 * @param {string} params.recipientName - Name of gift recipient
 * @param {string} params.occasion - Occasion (Birthday, Wedding, etc.)
 * @param {string} params.relationship - Relationship to recipient
 * @param {string} params.specialNotes - Special details/context
 * @param {boolean} params.hasPhoto - Whether customer provided a photo
 * @returns {string} - The prompt to send to Gemini for generation
 */
export function getCreativePrompt({ recipientName, occasion, relationship, specialNotes, hasPhoto }) {
    // Sanitize all inputs to handle special characters
    const safeName = sanitizeInput(recipientName);
    const safeOccasion = sanitizeInput(occasion);
    const safeRelationship = sanitizeInput(relationship);
    const safeNotes = sanitizeInput(specialNotes);

    return `System Role:
You are an expert Creative Director and Visual Designer for Printo (www.printo.in) - a premium gifting company.
Your goal is to deliver a quirky finished gift concept and a realistic visual mockup immediately.
You make the creative decisions — do not ask the user for style preferences.

The Task:
Based on the details provided below, perform the following steps immediately:

1. Analyze & Decide: Infer the best artistic style
(e.g., Minimalist, Pop Art, Vintage, Elegant) based on the recipient's backstory (specialnotes) and occasion.
If data is inadequate to decide, choose Quirky.

2. Write the Copy: Create one perfect, punchy headline/message in Hinglish (max 10 words).
Theme: Bollywood movie dialogues or names (e.g., "Joh Jeeta Woh Manish", "Mujhe Ye Saath De De Thakur").
IMPORTANT: The copy MUST include the recipient's name "${safeName}" or reference their special details.
IMPORTANT: The copy should be relevant to the occasion "${safeOccasion}" and the backstory provided.

3. Generate the Visual image:
${hasPhoto ? 'Generate a high-quality gift mockup that combines the user\'s photo with the design theme.' :
        'Generate a high-end typography-based gift mockup design.'}

4. Select the Product: Choose the best physical product from printo.in (Canvas, Mug, Framed Print).

Input Details:
Occasion: ${safeOccasion}
Recipient: ${safeName}
Relation: ${safeRelationship}
Backstory: ${safeNotes}

Output Structure:
**THE STYLE:** [Style Name]
**THE COPY:** [Your Hinglish headline - MUST include ${safeName} or reference their details]
**THE PRODUCT:** [Product name]
**THE MOCKUP:** [Image will be attached automatically]`;
}


/**
 * PROMPT 3: Photo Integration Instructions (Optional)
 * Additional instructions when customer provides a photo
 *
 * @param {string} productType - Type of product (Mug, Canvas, Frame, etc.)
 * @returns {string} - Additional photo integration instructions
 */
export function getPhotoIntegrationPrompt(productType = 'gift product') {
    return `
PHOTO INTEGRATION RULES:
- The uploaded photo MUST appear DIRECTLY ON the ${productType} surface
- Photo must be PRINTED ON the product - NOT floating in background
- Preserve the photo's original quality, skin tones, and lighting
- The photo should look naturally printed/embedded on the product
- DO NOT generate new faces - use ONLY the uploaded photo`;
}


/**
 * Default values for fallback scenarios
 */
export const DEFAULTS = {
    recipientName: 'Friend',
    occasion: 'Special Day',
    relationship: 'Friend',
    specialNotes: 'Quirky gift',
    style: 'Quirky',
    product: 'Personalized Photo Mug'
};


/**
 * Model Configuration
 * Change these to use different AI models
 */
export const MODELS = {
    // Using single model for everything
    parsing: 'gemini-3-pro-image-preview',

    // Used for creative generation with images
    creative: 'gemini-3-pro-image-preview'
};
