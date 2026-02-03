/**
 * Personalized Gift Experience Engine
 *
 * Creates fully customized gift experiences - not just recommendations
 *
 * Flow:
 * 1. Collect detailed customer inputs
 * 2. Analyze emotional content and preferences
 * 3. Recommend perfect product
 * 4. Generate personalized message using GPT
 * 5. Create realistic mockup description
 * 6. Return complete customized gift experience
 */

const OpenAI = require('openai');
const ProductRecommender = require('./product-recommender');
const GeminiGiftCreator = require('./gemini-gift-creator');

class PersonalizedGiftEngine {
  constructor(config = {}) {
    this.openai = config.openai;
    this.productRecommender = new ProductRecommender(config);
    this.geminiCreator = new GeminiGiftCreator({
      ...config,
      geminiApiKey: config.geminiApiKey || process.env.GEMINI_API_KEY
    });
  }

  /**
   * Initialize - Load products
   */
  async initialize(forceRefresh = false) {
    console.log('[PersonalizedGift] Initializing...');
    await this.productRecommender.initialize(forceRefresh);
    console.log('[PersonalizedGift] Ready');
  }

  /**
   * Main method: Create personalized gift experience
   *
   * @param {Object} input - Customer input
   * @param {string} input.recipientName - Name of recipient
   * @param {string} input.occasion - Occasion (Valentine's, Birthday, etc.)
   * @param {number} input.budget - Budget in rupees
   * @param {string} input.relationship - Relationship (girlfriend, friend, etc.)
   * @param {string} input.specialNotes - Special details, emotions, traits
   * @param {string} input.recipientImage - Optional image URL/path
   */
  async createPersonalizedGift(input) {
    try {
      console.log('[PersonalizedGift] Creating experience for:', input.recipientName);

      // Step 1: Analyze inputs
      const analysis = await this.analyzeInputs(input);

      // Step 2: Get product recommendation
      const product = await this.recommendProduct(input, analysis);

      if (!product) {
        return {
          success: false,
          message: 'No suitable product found for your requirements'
        };
      }

      // Step 3: Generate personalized message
      const personalizedMessage = await this.generatePersonalizedMessage(input, analysis, product);

      // Step 4: Create customization details
      const customization = this.createCustomizationDetails(input, personalizedMessage, product);

      // Step 5: Generate GIFT CONCEPTS with Gemini (using tested GoC prompt)
      console.log('[PersonalizedGift] Generating gift concepts with Gemini...');
      const giftConcepts = await this.geminiCreator.generateMultipleVariations({
        occasion: input.occasion,
        recipientName: input.recipientName,
        relationship: input.relationship,
        specialNotes: input.specialNotes,
        customerPhoto: input.recipientImage,
        productType: this.getProductType(product.title),
        selectedProduct: product.title,  // Pass the EXACT selected product
        productLink: product.link        // Pass the product link too
      });

      console.log(`[PersonalizedGift] Generated ${giftConcepts.length} gift concepts from Gemini`);

      // Convert Gemini concepts to design variations format
      const designVariations = giftConcepts.map(concept => ({
        styleNumber: concept.styleNumber,
        styleName: concept.styleName || concept.designStyle,
        description: concept.description,
        headline: concept.headline,
        product: concept.product,
        imageUrl: concept.imageUrl || null, // DALL-E generated image URL
        designDetails: {
          fullResponse: concept.fullResponse,
          printoLink: concept.printoLink,
          imageIntegration: concept.imageIntegration
        }
      }));

      // Step 6: Generate mockup description (as fallback or additional info)
      const mockupDescription = await this.generateMockupDescription(input, product, customization);

      // Step 7: Build final response with MULTIPLE designs
      const experience = this.buildGiftExperience(input, product, personalizedMessage, customization, mockupDescription, analysis, designVariations);

      return {
        success: true,
        experience
      };

    } catch (error) {
      console.error('[PersonalizedGift] Error:', error);
      throw error;
    }
  }

  /**
   * Analyze customer inputs to understand emotional content
   */
  async analyzeInputs(input) {
    const prompt = `Analyze this gift request and extract emotional insights:

Recipient: ${input.recipientName}
Occasion: ${input.occasion}
Relationship: ${input.relationship}
Special Notes: "${input.specialNotes}"
Budget: ₹${input.budget}

Extract and return ONLY valid JSON:
{
  "emotionalTone": "romantic|friendly|grateful|celebratory|nostalgic|playful",
  "keyEmotions": ["love", "gratitude", "joy", etc.],
  "recipientTraits": ["caring", "fun", "supportive", etc.],
  "giftIntent": "express love|show gratitude|celebrate|make happy|surprise",
  "messageStyle": "heartfelt|playful|emotional|cheerful|warm",
  "productType": "personalized|decorative|functional|memorable"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert at analyzing emotional content in gift requests. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5
      });

      const analysis = JSON.parse(response.choices[0].message.content.trim());
      console.log('[PersonalizedGift] Analysis:', analysis);
      return analysis;

    } catch (error) {
      console.error('[PersonalizedGift] Analysis error:', error);
      // Fallback analysis
      return {
        emotionalTone: 'warm',
        keyEmotions: ['appreciation'],
        recipientTraits: ['special'],
        giftIntent: 'show appreciation',
        messageStyle: 'heartfelt',
        productType: 'personalized'
      };
    }
  }

  /**
   * Recommend the perfect product based on analysis
   */
  async recommendProduct(input, analysis) {
    // Build enhanced search query
    const enhancedQuery = `${input.occasion} gift for ${input.relationship} around ₹${input.budget}`;

    const result = await this.productRecommender.recommend(enhancedQuery, { count: 10 });

    if (!result.success || result.recommendations.length === 0) {
      return null;
    }

    // Filter out inappropriate products for personal occasions
    const inappropriateKeywords = ['trophy', 'trophies', 'award', 'awards', 'plaque', 'certificate', 'business card', 'corporate', 'office kit'];
    const personalOccasions = ['birthday', 'valentine', 'anniversary', 'friendship', 'thank you', 'friend'];

    let filteredProducts = result.recommendations;

    // If it's a personal occasion, filter out corporate/professional products
    const isPersonalOccasion = personalOccasions.some(occ =>
      input.occasion.toLowerCase().includes(occ) || input.relationship.toLowerCase().includes(occ)
    );

    if (isPersonalOccasion) {
      filteredProducts = result.recommendations.filter(rec => {
        const title = rec.title.toLowerCase();
        const category = (rec.category || '').toLowerCase();
        return !inappropriateKeywords.some(keyword =>
          title.includes(keyword) || category.includes(keyword)
        );
      });

      console.log(`[PersonalizedGift] Filtered from ${result.recommendations.length} to ${filteredProducts.length} products`);

      // If all products were filtered out, try to get personal products only
      if (filteredProducts.length === 0) {
        filteredProducts = result.recommendations.filter(rec => {
          const title = rec.title.toLowerCase();
          return title.includes('frame') || title.includes('mug') ||
                 title.includes('cushion') || title.includes('album') ||
                 title.includes('photo') || title.includes('personalized');
        });

        // Last resort: use original list
        if (filteredProducts.length === 0) {
          filteredProducts = result.recommendations;
        }
      }
    }

    // Select product - TRUST THE RECOMMENDER
    // The recommender now has gift impact scoring, so it already handles quality
    let selectedProduct = filteredProducts[0];
    const topProductTitle = selectedProduct.title.toLowerCase();

    // ONLY override if top product is a low-impact keepsake (magnet, puzzle)
    // AND we have a high-impact alternative in top 5
    const lowImpactItems = ['magnet', 'puzzle', 'jigsaw', 'fridge magnet', 'coaster', 'keychain'];
    const highImpactItems = ['hamper', 'gift set', 'canvas', 'album', 'cushion', 'pillow',
                              'led frame', 'diary set', 'bottle', 'sipper', 'calendar'];

    const isLowImpact = lowImpactItems.some(item => topProductTitle.includes(item));

    if (isLowImpact && filteredProducts.length > 1) {
      // Look for a HIGH-IMPACT alternative (not just "personalizable")
      const betterProduct = filteredProducts.slice(1, 5).find(rec => {
        const title = rec.title.toLowerCase();
        return highImpactItems.some(item => title.includes(item));
      });

      if (betterProduct) {
        console.log(`[PersonalizedGift] Upgrading from low-impact "${selectedProduct.title.substring(0, 30)}..." to "${betterProduct.title.substring(0, 30)}..."`);
        selectedProduct = betterProduct;
      }
    }

    console.log('[PersonalizedGift] Selected:', selectedProduct.title);
    return selectedProduct;
  }

  /**
   * Generate personalized message using GPT
   */
  async generatePersonalizedMessage(input, analysis, product) {
    const prompt = `You are a heartfelt gift message writer. Create a personalized message for a customized gift.

Context:
- Recipient Name: ${input.recipientName}
- Occasion: ${input.occasion}
- Relationship: ${input.relationship}
- Special Notes: "${input.specialNotes}"
- Product: ${product.title}
- Emotional Tone: ${analysis.emotionalTone}
- Message Style: ${analysis.messageStyle}

Write a beautiful, personalized message that will be printed/engraved on the gift.

Requirements:
- Address the recipient by name: "${input.recipientName}"
- Reference the occasion: ${input.occasion}
- Incorporate emotions from special notes
- Keep it 2-4 lines (suitable for printing on product)
- Make it warm, genuine, and memorable
- Tone: ${analysis.messageStyle}

Examples:
- For Valentine: "Rutuja, Your smile is my favorite view. Happy Valentine's Day! ❤️"
- For Birthday: "To my amazing friend Ravi, May your day be as wonderful as you are! Happy Birthday! 🎉"
- For Anniversary: "Two years of love, laughter, and memories. Here's to forever, darling. Happy Anniversary! 💕"

Generate the personalized message:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert at writing heartfelt, personalized gift messages. Keep messages concise but emotional.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 100
      });

      const message = response.choices[0].message.content.trim();
      console.log('[PersonalizedGift] Generated message:', message);
      return message;

    } catch (error) {
      console.error('[PersonalizedGift] Message generation error:', error);
      // Fallback message
      return `Dear ${input.recipientName},\nWishing you a wonderful ${input.occasion}!\nWith love and warm wishes.`;
    }
  }

  /**
   * Create customization details
   */
  createCustomizationDetails(input, personalizedMessage, product) {
    return {
      recipientName: input.recipientName,
      personalizedMessage: personalizedMessage,
      hasImage: !!input.recipientImage,
      imageUrl: input.recipientImage || null,
      customizationElements: this.identifyCustomizableElements(product),
      designStyle: this.suggestDesignStyle(input.occasion)
    };
  }

  /**
   * Identify what can be customized on the product
   */
  identifyCustomizableElements(product) {
    const elements = [];
    const titleLower = product.title.toLowerCase();

    if (titleLower.includes('photo') || titleLower.includes('picture')) {
      elements.push('photo_upload');
    }
    if (titleLower.includes('frame') || titleLower.includes('print') || titleLower.includes('mug')) {
      elements.push('text_message');
    }
    if (titleLower.includes('mug') || titleLower.includes('bottle') || titleLower.includes('diary')) {
      elements.push('name_engraving');
    }
    if (titleLower.includes('calendar')) {
      elements.push('multiple_photos');
    }

    // Default: most products support at least text
    if (elements.length === 0) {
      elements.push('text_message');
    }

    return elements;
  }

  /**
   * Suggest design style based on occasion
   */
  suggestDesignStyle(occasion) {
    const occasionLower = occasion.toLowerCase();

    if (occasionLower.includes('valentine')) {
      return {
        colors: ['Red', 'Pink', 'Rose Gold'],
        theme: 'Romantic',
        elements: ['Hearts', 'Flowers', 'Elegant fonts']
      };
    } else if (occasionLower.includes('birthday')) {
      return {
        colors: ['Vibrant', 'Colorful', 'Bright'],
        theme: 'Celebratory',
        elements: ['Balloons', 'Confetti', 'Fun fonts']
      };
    } else if (occasionLower.includes('anniversary')) {
      return {
        colors: ['Gold', 'Silver', 'Elegant tones'],
        theme: 'Sophisticated',
        elements: ['Rings', 'Hearts', 'Classic fonts']
      };
    } else if (occasionLower.includes('raksha') || occasionLower.includes('rakhi')) {
      return {
        colors: ['Traditional', 'Warm tones'],
        theme: 'Traditional',
        elements: ['Rakhi motifs', 'Ethnic patterns']
      };
    }

    // Default
    return {
      colors: ['Elegant', 'Warm tones'],
      theme: 'Classic',
      elements: ['Simple', 'Meaningful']
    };
  }

  /**
   * Generate mockup IMAGE using Canvas (Fast, Free, Reliable)
   */
  async generateMockupImageCanvas(input, product, customization, personalizedMessage) {
    try {
      console.log('[PersonalizedGift] Generating mockup image with Canvas...');

      const mockupConfig = {
        productImageUrl: product.imageLink,
        recipientName: input.recipientName,
        personalizedMessage: personalizedMessage,
        occasion: input.occasion,
        designStyle: customization.designStyle,
        productType: this.getProductType(product.title)
      };

      const dataUrl = await this.mockupGenerator.generateMockup(mockupConfig);

      if (dataUrl) {
        console.log('[PersonalizedGift] Canvas mockup generated successfully');
        return dataUrl;
      } else {
        console.log('[PersonalizedGift] Canvas mockup failed, using product image');
        return product.imageLink;
      }

    } catch (error) {
      console.error('[PersonalizedGift] Canvas mockup generation error:', error.message);
      // Fallback to product image
      return product.imageLink;
    }
  }

  /**
   * Generate photo-realistic mockup IMAGE using DALL-E (DISABLED - too slow/expensive)
   */
  async generateMockupImage(input, product, customization) {
    // DALL-E disabled in favor of Canvas approach
    // Keeping for reference if needed in future
    return null;
  }

  /**
   * Build DALL-E prompt for mockup image - PRINT-READY PREVIEW
   */
  buildImagePrompt(input, product, customization) {
    const productType = this.getProductType(product.title);
    const style = customization.designStyle;

    // Clean the message - remove extra quotes
    const cleanMessage = customization.personalizedMessage.replace(/^["']|["']$/g, '').substring(0, 150);

    let prompt = `A realistic, print-ready preview of a personalized ${productType} showing exactly how the final product will look after printing. `;

    // CRITICAL: Show the actual text that will be printed
    prompt += `The product clearly displays the following personalized text:\n\n`;
    prompt += `At the top in ${style.theme.toLowerCase()} elegant font: "${input.recipientName}"\n\n`;
    prompt += `Main message printed on the product: "${cleanMessage}"\n\n`;

    // Product-specific layout
    if (productType.includes('frame')) {
      prompt += `This is a ${productType} with the personalized text overlaid on the frame border or mat. `;
      if (input.recipientImage) {
        prompt += `A customer photo is displayed in the center of the frame. `;
      } else {
        prompt += `The center has decorative ${input.occasion} themed patterns (${style.elements.join(', ')}). `;
      }
    } else if (productType.includes('mug')) {
      prompt += `This is a ${productType} with the personalized text wrapped around the front face of the mug. `;
      if (input.recipientImage) {
        prompt += `A customer photo is printed above or beside the text. `;
      }
    } else if (productType.includes('cushion')) {
      prompt += `This is a ${productType} with the personalized text centered on the cushion cover. `;
      if (input.recipientImage) {
        prompt += `A customer photo is printed at the top, with text below. `;
      }
    } else {
      // Generic layout
      prompt += `The personalized text is prominently displayed on the ${productType}. `;
      if (input.recipientImage) {
        prompt += `A customer photo is integrated into the design. `;
      }
    }

    // Design style and colors
    prompt += `The design uses ${style.colors.join(', ')} colors in a ${style.theme.toLowerCase()} style. `;
    prompt += `Decorative elements: ${style.elements.join(', ')}. `;

    // Quality requirements for PRINT-READY preview
    prompt += `The text must be clearly readable and prominent. `;
    prompt += `Professional product photography, studio lighting, white or neutral background. `;
    prompt += `Show the complete product from a flatlay or front-facing angle. `;
    prompt += `The personalization should look exactly as it would after professional printing.`;

    return prompt;
  }

  /**
   * Determine product type from title
   */
  getProductType(title) {
    const titleLower = title.toLowerCase();

    if (titleLower.includes('frame')) return 'photo frame';
    if (titleLower.includes('mug')) return 'ceramic mug';
    if (titleLower.includes('cushion')) return 'cushion';
    if (titleLower.includes('album')) return 'photo album';
    if (titleLower.includes('calendar')) return 'wall calendar';
    if (titleLower.includes('diary')) return 'diary';
    if (titleLower.includes('notebook')) return 'notebook';
    if (titleLower.includes('puzzle')) return 'jigsaw puzzle';
    if (titleLower.includes('bottle')) return 'water bottle';
    if (titleLower.includes('sipper')) return 'sipper';
    if (titleLower.includes('hamper')) return 'gift hamper';

    return 'personalized gift product';
  }

  /**
   * Generate photo-realistic mockup description (fallback for when image fails)
   */
  async generateMockupDescription(input, product, customization) {
    const prompt = `Create a detailed, photo-realistic mockup description for an e-commerce preview.

Product: ${product.title}
Recipient Name: ${input.recipientName}
Personalized Message: "${customization.personalizedMessage}"
Has Photo: ${customization.hasImage ? 'Yes' : 'No'}
Design Style: ${JSON.stringify(customization.designStyle)}

Describe how the final customized product would look. Include:
1. Product appearance and material
2. Placement of recipient name
3. Placement and styling of personalized message
4. Photo placement (if applicable)
5. Color scheme and design elements
6. Overall visual impact

Make it realistic and detailed so customer can visualize the final product.

Keep description concise (4-6 sentences) but vivid.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert at creating product mockup descriptions for e-commerce. Be specific and visual.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      return response.choices[0].message.content.trim();

    } catch (error) {
      console.error('[PersonalizedGift] Mockup description error:', error);
      return `Your customized ${product.title} will feature "${input.recipientName}" in elegant typography, with your heartfelt message beautifully displayed. The ${customization.designStyle.theme.toLowerCase()} design complements the ${input.occasion} theme perfectly.`;
    }
  }

  /**
   * Build final gift experience response with MULTIPLE design variations
   */
  buildGiftExperience(input, product, personalizedMessage, customization, mockupDescription, analysis, designVariations) {
    return {
      // Product recommendation
      product: {
        title: product.title,
        price: product.price,
        priceDisplay: product.priceDisplay,
        category: product.category,
        link: product.link,
        imageLink: product.imageLink,
        deliveryInfo: product.deliveryInfo || '',
        description: product.description
      },

      // Personalization
      personalization: {
        recipientName: input.recipientName,
        message: personalizedMessage,
        hasImage: customization.hasImage,
        customizableElements: customization.customizationElements
      },

      // MULTIPLE Design Variations (2-3 trending options)
      designVariations: designVariations || [],
      totalDesigns: (designVariations || []).length,

      // Legacy design field for backward compatibility
      design: {
        style: customization.designStyle,
        mockupDescription: mockupDescription,
        mockupImageUrl: designVariations && designVariations.length > 0 ? designVariations[0].imageUrl : null
      },

      // Emotional context
      experience: {
        occasion: input.occasion,
        relationship: input.relationship,
        emotionalTone: analysis.emotionalTone,
        giftIntent: analysis.giftIntent,
        recipientTraits: analysis.recipientTraits
      },

      // Summary
      summary: this.buildSummary(input, product, personalizedMessage, mockupDescription)
    };
  }

  /**
   * Build user-friendly summary
   */
  buildSummary(input, product, personalizedMessage, mockupDescription) {
    return `🎁 *Personalized Gift Experience for ${input.recipientName}*

*Perfect Product:*
${product.title}
₹${product.price}

*Your Personalized Message:*
"${personalizedMessage}"

*How It Will Look:*
${mockupDescription}

*Next Steps:*
1. Review the mockup description above
2. ${product.link}
3. Upload your photo (if applicable)
4. Add your personalized message
5. Place your order

Make this ${input.occasion} unforgettable! ✨`;
  }
}

module.exports = PersonalizedGiftEngine;
