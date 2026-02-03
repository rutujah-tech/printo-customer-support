/**
 * Image Personalizer - Creates print-ready product images
 * Uses AI to decide layout, fonts, colors, and design based on occasion
 * Uses DALL-E 3 to generate actual print-ready images (no canvas required)
 */

const OpenAI = require('openai');

class ImagePersonalizer {
  constructor(config = {}) {
    this.openai = config.openai;
  }

  /**
   * Generate print-ready personalized product image
   */
  async generatePersonalizedImage(config) {
    const {
      productImageUrl,
      recipientName,
      personalizedMessage,
      customerPhoto,
      occasion,
      relationship,
      productType
    } = config;

    try {
      console.log('[ImagePersonalizer] Generating print-ready image...');

      // Step 1: Get AI design decisions
      const designDecisions = await this.getAIDesignDecisions({
        occasion,
        relationship,
        recipientName,
        personalizedMessage,
        productType
      });

      console.log('[ImagePersonalizer] AI Design:', designDecisions);

      // Step 2: Generate image using DALL-E with specific design instructions
      const printReadyImage = await this.generateWithDALLE({
        productType,
        recipientName,
        personalizedMessage,
        customerPhoto,
        designDecisions
      });

      console.log('[ImagePersonalizer] Print-ready image generated');
      return printReadyImage;

    } catch (error) {
      console.error('[ImagePersonalizer] Error:', error.message);
      return null;
    }
  }

  /**
   * AI decides design layout, fonts, colors, placement
   */
  async getAIDesignDecisions(input) {
    const prompt = `You are an expert graphic designer. Design a personalized gift product based on this information:

Occasion: ${input.occasion}
Relationship: ${input.relationship}
Recipient Name: ${input.recipientName}
Message: "${input.personalizedMessage}"
Product Type: ${input.productType}

Decide the design parameters and return ONLY valid JSON:
{
  "layout": "photo-centered|text-centered|photo-and-text|text-only",
  "textPlacement": "top|center|bottom|left|right|overlay",
  "namePlacement": "top-center|top-left|center|bottom-center",
  "messagePlacement": "below-name|center|bottom|side",
  "fontStyle": "elegant-script|modern-sans|bold-display|handwritten|classic-serif",
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "text": "#hex",
    "background": "#hex"
  },
  "designStyle": "romantic|minimal|bold|playful|elegant|modern|traditional",
  "decorativeElements": ["hearts", "flowers", "stars", etc],
  "photoEffect": "none|border|circular|vintage|polaroid"
}

Choose based on:
- Romantic occasions (Valentine, Anniversary) → elegant fonts, hearts, warm colors
- Birthdays → playful, bold, bright colors, celebrations
- Professional → minimal, clean, muted colors
- Traditional (Rakhi, Diwali) → traditional patterns, warm colors

Return only the JSON.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert graphic designer. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      });

      return JSON.parse(response.choices[0].message.content.trim());

    } catch (error) {
      console.error('[ImagePersonalizer] AI design error:', error);
      // Fallback design
      return {
        layout: 'text-centered',
        textPlacement: 'center',
        namePlacement: 'top-center',
        messagePlacement: 'below-name',
        fontStyle: 'elegant-script',
        colorPalette: {
          primary: '#E91E63',
          secondary: '#F8BBD0',
          text: '#FFFFFF',
          background: '#FFF'
        },
        designStyle: 'elegant',
        decorativeElements: ['hearts'],
        photoEffect: 'border'
      };
    }
  }

  /**
   * Generate actual print-ready image using DALL-E
   */
  async generateWithDALLE(config) {
    const {
      productType,
      recipientName,
      personalizedMessage,
      customerPhoto,
      designDecisions
    } = config;

    // Build detailed DALL-E prompt for print-ready image
    const prompt = this.buildDALLEPrompt(config);

    try {
      console.log('[ImagePersonalizer] Calling DALL-E...');

      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
        style: 'natural'
      });

      return response.data[0].url;

    } catch (error) {
      console.error('[ImagePersonalizer] DALL-E error:', error.message);
      return null;
    }
  }

  /**
   * Build detailed DALL-E prompt for print-ready product image
   */
  buildDALLEPrompt(config) {
    const { productType, recipientName, personalizedMessage, designDecisions } = config;

    const colorPalette = designDecisions.colorPalette;
    const fontStyle = this.getFontDescription(designDecisions.fontStyle);

    let prompt = `Create a professional, print-ready design for a ${productType}. This is the FINAL design that will be printed on the product.\n\n`;

    // Product type specific instructions
    if (productType.includes('mug')) {
      prompt += `Design layout for the front face of a ceramic mug (flat layout, 3:2 aspect ratio).\n`;
    } else if (productType.includes('frame')) {
      prompt += `Design layout for a photo frame border/mat (the area around the photo space).\n`;
    } else if (productType.includes('cushion')) {
      prompt += `Design layout for a square cushion cover (centered design).\n`;
    } else if (productType.includes('diary') || productType.includes('notebook')) {
      prompt += `Design layout for a diary/notebook cover (portrait orientation).\n`;
    } else {
      prompt += `Design layout for the product surface (centered design).\n`;
    }

    // Layout instructions
    prompt += `\nLayout Style: ${designDecisions.layout}\n`;
    prompt += `Design Style: ${designDecisions.designStyle}\n\n`;

    // Text content - CRITICAL
    prompt += `CRITICAL - Print this text EXACTLY:\n`;
    prompt += `1. Recipient Name: "${recipientName}" (${designDecisions.namePlacement}, ${fontStyle})\n`;
    prompt += `2. Message: "${personalizedMessage.substring(0, 150)}" (${designDecisions.messagePlacement}, smaller ${fontStyle})\n\n`;

    // Color scheme
    prompt += `Color Palette:\n`;
    prompt += `- Primary: ${colorPalette.primary}\n`;
    prompt += `- Secondary: ${colorPalette.secondary}\n`;
    prompt += `- Text: ${colorPalette.text}\n`;
    prompt += `- Background: ${colorPalette.background}\n\n`;

    // Decorative elements
    if (designDecisions.decorativeElements && designDecisions.decorativeElements.length > 0) {
      prompt += `Decorative Elements: ${designDecisions.decorativeElements.join(', ')} (subtle, not overwhelming)\n\n`;
    }

    // Photo handling
    if (config.customerPhoto) {
      prompt += `Include a ${designDecisions.photoEffect} photo placeholder in the design.\n\n`;
    }

    // Quality requirements
    prompt += `Requirements:\n`;
    prompt += `- Print-ready quality, high resolution\n`;
    prompt += `- Text must be CLEARLY readable and prominent\n`;
    prompt += `- Professional typography and spacing\n`;
    prompt += `- Balanced composition\n`;
    prompt += `- Product mockup view (show how it looks on the actual product)\n`;
    prompt += `- This will be printed, so text clarity is CRITICAL\n`;

    return prompt;
  }

  /**
   * Convert font style to description
   */
  getFontDescription(fontStyle) {
    const descriptions = {
      'elegant-script': 'flowing, elegant cursive font',
      'modern-sans': 'clean, modern sans-serif font',
      'bold-display': 'bold, eye-catching display font',
      'handwritten': 'natural handwritten style font',
      'classic-serif': 'classic, traditional serif font'
    };

    return descriptions[fontStyle] || 'elegant font';
  }
}

module.exports = ImagePersonalizer;
