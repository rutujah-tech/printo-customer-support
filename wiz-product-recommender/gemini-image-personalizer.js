/**
 * Gemini Image Personalizer - Creates print-ready product images using Google Gemini
 * Supports real photo uploads with trending design styles
 * Generates multiple design variations
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class GeminiImagePersonalizer {
  constructor(config = {}) {
    this.geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
    this.openai = config.openai; // For text generation fallback
  }

  /**
   * Generate multiple print-ready personalized product images with trending styles
   */
  async generatePersonalizedImages(config) {
    const {
      productImageUrl,
      recipientName,
      personalizedMessage,
      customerPhoto, // Base64 or URL
      occasion,
      relationship,
      productType
    } = config;

    try {
      console.log('[GeminiPersonalizer] Generating multiple print-ready designs...');

      // Step 1: Get AI design decisions for MULTIPLE variations
      const designVariations = await this.getMultipleDesignDecisions({
        occasion,
        relationship,
        recipientName,
        personalizedMessage,
        productType,
        hasPhoto: !!customerPhoto
      });

      console.log('[GeminiPersonalizer] Generated', designVariations.length, 'design variations');

      // Step 2: Generate images for each design variation
      const generatedImages = [];

      for (let i = 0; i < designVariations.length; i++) {
        const design = designVariations[i];
        console.log(`[GeminiPersonalizer] Generating design ${i + 1}/${designVariations.length}: ${design.styleName}`);

        try {
          const imageUrl = await this.generateWithGemini({
            productType,
            recipientName,
            personalizedMessage,
            customerPhoto,
            designDecision: design
          });

          if (imageUrl) {
            generatedImages.push({
              styleNumber: i + 1,
              styleName: design.styleName,
              description: design.description,
              imageUrl: imageUrl,
              designDetails: design
            });
          }
        } catch (error) {
          console.error(`[GeminiPersonalizer] Failed to generate design ${i + 1}:`, error.message);
          // Continue with other designs
        }
      }

      console.log('[GeminiPersonalizer] Successfully generated', generatedImages.length, 'images');
      return generatedImages;

    } catch (error) {
      console.error('[GeminiPersonalizer] Error:', error.message);
      return [];
    }
  }

  /**
   * AI decides MULTIPLE design variations (2-3 options) with trending styles
   */
  async getMultipleDesignDecisions(input) {
    const prompt = `You are an expert graphic designer specializing in trending, modern gift personalization designs.

Customer Details:
- Occasion: ${input.occasion}
- Relationship: ${input.relationship}
- Recipient Name: ${input.recipientName}
- Message: "${input.personalizedMessage}"
- Product Type: ${input.productType}
- Has Customer Photo: ${input.hasPhoto ? 'YES' : 'NO'}

Create 3 DIFFERENT trending design variations that are popular on social media (Instagram, Pinterest, Gebli trends).

TRENDING STYLES TO USE:
1. **Modern Minimalist** - Clean lines, negative space, Instagram-worthy aesthetic
2. **Bold Colorful** - Vibrant gradients, Gen-Z colors, eye-catching
3. **Elegant Classic** - Timeless typography, sophisticated, Pinterest-inspired
4. **Playful Fun** - Quirky illustrations, stickers, Gen-Z playful vibes
5. **Gebli Trend** - Trendy Indian aesthetics, modern Indian design elements
6. **Social Media Style** - Story-style frames, modern filters, trending layouts

Return ONLY valid JSON array with 3 design options:
[
  {
    "styleNumber": 1,
    "styleName": "Modern Minimalist",
    "description": "Clean Instagram-worthy design with elegant spacing",
    "layout": "photo-centered|text-centered|photo-and-text|text-only",
    "textPlacement": "top|center|bottom|overlay",
    "namePlacement": "top-center|center|bottom",
    "messagePlacement": "below-name|center|side",
    "fontStyle": "elegant-script|modern-sans|bold-display|handwritten|classic-serif",
    "colorPalette": {
      "primary": "#hex",
      "secondary": "#hex",
      "text": "#hex",
      "background": "#hex"
    },
    "designStyle": "minimal|bold|playful|elegant|modern|gebli|social-media",
    "decorativeElements": ["geometric-shapes", "gradients", etc],
    "photoEffect": "none|border|circular|vintage|polaroid|instagram-filter",
    "trendingFeatures": ["gradient-overlay", "modern-frame", "story-style", etc]
  },
  // ... 2 more variations
]

Make each design DISTINCTLY DIFFERENT and trendy for 2024-2025!`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an expert in trending graphic design for social media. Return only valid JSON array.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.9, // Higher for more creative variations
        max_tokens: 1500
      });

      const content = response.choices[0].message.content.trim();
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const designs = JSON.parse(jsonContent);

      return Array.isArray(designs) ? designs.slice(0, 3) : [designs];

    } catch (error) {
      console.error('[GeminiPersonalizer] Design generation error:', error);
      // Fallback designs
      return this.getFallbackDesigns(input);
    }
  }

  /**
   * Generate image using Gemini with specific design
   */
  async generateWithGemini(config) {
    const {
      productType,
      recipientName,
      personalizedMessage,
      customerPhoto,
      designDecision
    } = config;

    // Build detailed Gemini prompt
    const prompt = this.buildGeminiPrompt(config);

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

      // Prepare the content
      const parts = [{ text: prompt }];

      // Add customer photo if provided
      if (customerPhoto) {
        // If it's a base64 string
        if (customerPhoto.startsWith('data:image')) {
          const base64Data = customerPhoto.split(',')[1];
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          });
        } else if (customerPhoto.startsWith('http')) {
          // If it's a URL, download and convert to base64
          const imageResponse = await axios.get(customerPhoto, { responseType: 'arraybuffer' });
          const base64Data = Buffer.from(imageResponse.data).toString('base64');
          parts.push({
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data
            }
          });
        }
      }

      const result = await model.generateContent(parts);
      const response = result.response;
      const generatedText = response.text();

      // Gemini returns text descriptions, we need to use image generation API
      // For now, return a placeholder or use Imagen API
      console.log('[GeminiPersonalizer] Gemini response:', generatedText.substring(0, 200));

      // TODO: Use Imagen API or return design specifications
      // For now, we'll return null and you can integrate actual image generation
      return null;

    } catch (error) {
      console.error('[GeminiPersonalizer] Gemini error:', error.message);
      return null;
    }
  }

  /**
   * Build detailed Gemini prompt for image generation
   */
  buildGeminiPrompt(config) {
    const { productType, recipientName, personalizedMessage, designDecision } = config;

    let prompt = `Create a professional, print-ready design for a ${productType} with this EXACT style:\n\n`;

    prompt += `STYLE: ${designDecision.styleName}\n`;
    prompt += `DESCRIPTION: ${designDecision.description}\n\n`;

    prompt += `EXACT TEXT TO PRINT:\n`;
    prompt += `1. Name: "${recipientName}" (${designDecision.namePlacement})\n`;
    prompt += `2. Message: "${personalizedMessage.substring(0, 150)}" (${designDecision.messagePlacement})\n\n`;

    prompt += `DESIGN SPECIFICATIONS:\n`;
    prompt += `- Layout: ${designDecision.layout}\n`;
    prompt += `- Font Style: ${this.getFontDescription(designDecision.fontStyle)}\n`;
    prompt += `- Design Style: ${designDecision.designStyle}\n`;
    prompt += `- Color Palette:\n`;
    prompt += `  * Primary: ${designDecision.colorPalette.primary}\n`;
    prompt += `  * Secondary: ${designDecision.colorPalette.secondary}\n`;
    prompt += `  * Text: ${designDecision.colorPalette.text}\n`;
    prompt += `  * Background: ${designDecision.colorPalette.background}\n`;

    if (designDecision.decorativeElements && designDecision.decorativeElements.length > 0) {
      prompt += `- Decorative Elements: ${designDecision.decorativeElements.join(', ')}\n`;
    }

    if (designDecision.trendingFeatures && designDecision.trendingFeatures.length > 0) {
      prompt += `- Trending Features: ${designDecision.trendingFeatures.join(', ')}\n`;
    }

    prompt += `\nREQUIREMENTS:\n`;
    prompt += `- PRINT-READY quality (high resolution)\n`;
    prompt += `- Text must be CRYSTAL CLEAR and readable\n`;
    prompt += `- Modern, trendy, Instagram/Pinterest-worthy aesthetic\n`;
    prompt += `- Professional typography and spacing\n`;
    prompt += `- Balanced, eye-catching composition\n`;
    prompt += `- This will be PRINTED on physical product\n`;

    return prompt;
  }

  /**
   * Convert font style to description
   */
  getFontDescription(fontStyle) {
    const descriptions = {
      'elegant-script': 'Flowing, elegant cursive font (think wedding invitations)',
      'modern-sans': 'Clean, modern sans-serif font (think Apple/Google style)',
      'bold-display': 'Bold, eye-catching display font (think Instagram posts)',
      'handwritten': 'Natural handwritten style font (think personal notes)',
      'classic-serif': 'Classic, traditional serif font (think newspapers)'
    };

    return descriptions[fontStyle] || 'Modern elegant font';
  }

  /**
   * Fallback designs if AI fails
   */
  getFallbackDesigns(input) {
    const baseDesign = {
      layout: 'photo-and-text',
      textPlacement: 'bottom',
      namePlacement: 'top-center',
      messagePlacement: 'below-name',
      decorativeElements: [],
      photoEffect: 'border'
    };

    // Minimal Design
    const minimal = {
      ...baseDesign,
      styleNumber: 1,
      styleName: 'Modern Minimal',
      description: 'Clean, elegant design with plenty of white space',
      fontStyle: 'modern-sans',
      colorPalette: { primary: '#000000', secondary: '#FFFFFF', text: '#000000', background: '#FFFFFF' },
      designStyle: 'minimal',
      trendingFeatures: ['negative-space', 'clean-typography']
    };

    // Bold Design
    const bold = {
      ...baseDesign,
      styleNumber: 2,
      styleName: 'Bold & Vibrant',
      description: 'Eye-catching design with vibrant colors',
      fontStyle: 'bold-display',
      colorPalette: { primary: '#FF6B6B', secondary: '#4ECDC4', text: '#FFFFFF', background: '#FFE66D' },
      designStyle: 'bold',
      decorativeElements: ['gradients', 'geometric-shapes'],
      trendingFeatures: ['gradient-overlay', 'bold-colors']
    };

    // Elegant Design
    const elegant = {
      ...baseDesign,
      styleNumber: 3,
      styleName: 'Elegant Classic',
      description: 'Timeless, sophisticated design',
      fontStyle: 'elegant-script',
      colorPalette: { primary: '#D4AF37', secondary: '#F5F5DC', text: '#2C3E50', background: '#FFFFFF' },
      designStyle: 'elegant',
      decorativeElements: ['floral-borders', 'ornaments'],
      trendingFeatures: ['classic-frame', 'elegant-borders']
    };

    return [minimal, bold, elegant];
  }
}

module.exports = GeminiImagePersonalizer;
