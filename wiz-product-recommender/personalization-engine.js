/**
 * WIZ Personalization Engine v2.1
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

class PersonalizationEngine {
  constructor(config = {}) {
    this.geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
  }

  async createPersonalizedFile(input) {
    const startTime = Date.now();
    try {
      console.log('[WIZ] Creating for:', input.recipientName, '| Photo:', !!input.photo);
      const result = await this.generate(input);
      return { success: true, result: { ...result, responseTime: Date.now() - startTime } };
    } catch (error) {
      console.error('[WIZ] Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async generate(input) {
    const { recipientName, occasion, relationship, specialNotes, photo } = input;
    const hasPhoto = !!photo;

    const prompt = `System Role:
You are an expert Creative Director and Visual Designer for Printo (www.printo.in) - a premium gifting company. Your goal is to deliver a finished gift concept and a realistic visual mockup immediately. You make the creative decisions—do not ask the user for style preferences.

The Task:
Based on the details provided below, perform the following steps immediately:

1. Analyze & Decide: Infer the best artistic style (e.g., Minimalist, Pop Art, Vintage, Elegant) based on the recipient's backstory and occasion. If data is inadequate to decide, choose Elegant.

2. Write the Copy: This is the crux. Create one perfect, punchy headline/message that incorporates the names and the "special" angle. Copy should not be more than 8 words. Copy language should be Hinglish.
Copy themes: Base the copy on famous hindi movie names or dialogues - modifying a word or two in a popular line or movie name (eg. Joh Jeeta Woh Manish - instead of Jo Jeeta Woh Sikander; "Mujhe Ye Saath De De Thakur - instead of haath de de thakur). Choose Hinglish as the first choice, using very simple hindi words.

3. Keep the copy restricted to 10 words.

4. Generate the Visual image as a .png (Mandatory): ${hasPhoto ? 'Generate an image that combines the photo uploaded with the copy based on the theme provided.' : 'NO photo is provided: You MUST create a high-end typography or illustration-based design using the names and message.'}

5. Select the Product: Choose the single best physical product (Canvas, Framed Print, Mug, etc.) for this design.
Incorporate the image created artistically (blended, framed, or stylized) into the design.

Input Details:

Occasion: ${occasion}
Recipient Name (multiple names separated by commas): ${recipientName}
Relationship: ${relationship}
Main Interests or Any Backstory (The "Special Sauce"): ${specialNotes}
Attached Photos: ${hasPhoto ? 'YES - Photo is attached below' : 'NO photo provided'}

Design & Output Rules:

Do not ask questions. Make the creative choices yourself.
One Image Only: Generate exactly one high-quality, realistic mockup of the gift sitting in a real-world setting (e.g., on a desk or wall).
Text on Image: The generated image must clearly show the Names and the Message you wrote.

Output Structure:

**THE STYLE:** [Minimalist/Pop Art/Vintage/Elegant]

**THE COPY:** [Your Hinglish headline - max 10 words]

**THE PRODUCT:** [Product name with Printo link, e.g., "A3 Matte Framed Print - https://www.printo.in/photo-frames"]

**THE MOCKUP:** [Generate the image here - this is mandatory]`;

    console.log('[WIZ] Calling Gemini...');

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp-image-generation',
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] }
    });

    let result;
    if (hasPhoto) {
      const imageParts = await this.prepareImage(photo);
      if (imageParts) {
        result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }, imageParts] }] });
      } else {
        result = await model.generateContent(prompt);
      }
    } else {
      result = await model.generateContent(prompt);
    }

    return this.parseResponse(result.response, recipientName, occasion, relationship);
  }

  parseResponse(response, recipientName, occasion, relationship) {
    const result = { recipientName, occasion, relationship, style: 'Elegant', copy: '', product: '', imageUrl: null };
    if (!response.candidates?.[0]) return result;

    const parts = response.candidates[0].content?.parts || [];
    let text = '';

    for (const part of parts) {
      if (part.text) text += part.text;
      if (part.inlineData?.data) {
        result.imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        console.log('[WIZ] Image generated');
      }
    }

    const copyMatch = text.match(/\*\*THE COPY:\*\*\s*(.+?)(?:\n|$)/i);
    if (copyMatch) result.copy = copyMatch[1].trim();

    const productMatch = text.match(/\*\*THE PRODUCT:\*\*\s*(.+?)(?:\n|$)/i);
    if (productMatch) result.product = productMatch[1].trim();

    const styleMatch = text.match(/\*\*THE STYLE:\*\*\s*(.+?)(?:\n|$)/i);
    if (styleMatch) result.style = styleMatch[1].trim();

    return result;
  }

  async prepareImage(photo) {
    try {
      let base64, mimeType = 'image/jpeg';
      if (photo.startsWith('data:')) {
        const m = photo.match(/^data:(.+);base64,(.+)$/);
        if (m) { mimeType = m[1]; base64 = m[2]; }
      } else if (photo.startsWith('http')) {
        const res = await fetch(photo);
        base64 = Buffer.from(await res.arrayBuffer()).toString('base64');
        mimeType = res.headers.get('content-type') || 'image/jpeg';
      } else if (photo.length > 100) {
        base64 = photo;
      }
      return base64 ? { inlineData: { mimeType, data: base64 } } : null;
    } catch (e) {
      console.error('[WIZ] Image prep error:', e.message);
      return null;
    }
  }
}

module.exports = PersonalizationEngine;
