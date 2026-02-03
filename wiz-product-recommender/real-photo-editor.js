/**
 * Real Photo Editor - Applies text overlays on customer's actual photos
 * No fake AI generation - uses real photos with professional design overlays
 */

const { createCanvas, loadImage, registerFont } = require('canvas');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

class RealPhotoEditor {
  constructor(config = {}) {
    this.openai = config.openai;
  }

  /**
   * Generate 3 design variations on the REAL customer photo
   */
  async generateDesignVariations(config) {
    const {
      customerPhoto, // base64 or URL
      recipientName,
      personalizedMessage,
      occasion,
      relationship,
      productType
    } = config;

    try {
      console.log('[RealPhotoEditor] Creating 3 design variations on customer photo...');

      // Step 1: Get AI design decisions for 3 variations
      const designVariations = await this.getMultipleDesignDecisions({
        occasion,
        relationship,
        recipientName,
        personalizedMessage,
        productType,
        hasPhoto: !!customerPhoto
      });

      console.log('[RealPhotoEditor] Generated', designVariations.length, 'design specifications');

      // Step 2: Apply each design to the customer's photo
      const generatedImages = [];

      for (let i = 0; i < designVariations.length; i++) {
        const design = designVariations[i];
        console.log(`[RealPhotoEditor] Applying design ${i + 1}/${designVariations.length}: ${design.styleName}`);

        try {
          const imageBase64 = await this.applyDesignToPhoto({
            customerPhoto,
            recipientName,
            personalizedMessage,
            designDecision: design,
            productType
          });

          if (imageBase64) {
            generatedImages.push({
              styleNumber: i + 1,
              styleName: design.styleName,
              description: design.description,
              imageUrl: imageBase64, // base64 data URL
              designDetails: design
            });
          }
        } catch (error) {
          console.error(`[RealPhotoEditor] Failed to apply design ${i + 1}:`, error.message);
          // Continue with other designs
        }
      }

      console.log('[RealPhotoEditor] Successfully created', generatedImages.length, 'design variations');
      return generatedImages;

    } catch (error) {
      console.error('[RealPhotoEditor] Error:', error.message);
      return [];
    }
  }

  /**
   * Get 3 different design specifications from AI
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
        temperature: 0.9,
        max_tokens: 1500
      });

      const content = response.choices[0].message.content.trim();
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const designs = JSON.parse(jsonContent);

      return Array.isArray(designs) ? designs.slice(0, 3) : [designs];

    } catch (error) {
      console.error('[RealPhotoEditor] Design generation error:', error);
      return this.getFallbackDesigns(input);
    }
  }

  /**
   * Apply design overlay to customer's photo using Canvas
   */
  async applyDesignToPhoto(config) {
    const {
      customerPhoto,
      recipientName,
      personalizedMessage,
      designDecision,
      productType
    } = config;

    try {
      // Load customer photo
      let photoImage;
      if (customerPhoto) {
        if (customerPhoto.startsWith('data:image')) {
          // Base64 image
          photoImage = await loadImage(customerPhoto);
        } else if (customerPhoto.startsWith('http')) {
          // URL
          photoImage = await loadImage(customerPhoto);
        }
      }

      // If no photo provided, create a blank canvas with background color
      const canvasWidth = photoImage ? photoImage.width : 1200;
      const canvasHeight = photoImage ? photoImage.height : 1200;

      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext('2d');

      // Step 1: Draw customer photo or background
      if (photoImage) {
        ctx.drawImage(photoImage, 0, 0, canvasWidth, canvasHeight);

        // Apply photo effect (border, circular, etc.)
        this.applyPhotoEffect(ctx, canvasWidth, canvasHeight, designDecision.photoEffect);
      } else {
        // No photo - fill with background color
        ctx.fillStyle = designDecision.colorPalette.background || '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      }

      // Step 2: Add overlay/background for text readability
      this.addTextOverlay(ctx, canvasWidth, canvasHeight, designDecision);

      // Step 3: Add decorative elements
      this.addDecorativeElements(ctx, canvasWidth, canvasHeight, designDecision);

      // Step 4: Add recipient name
      this.addRecipientName(ctx, canvasWidth, canvasHeight, recipientName, designDecision);

      // Step 5: Add personalized message
      this.addMessage(ctx, canvasWidth, canvasHeight, personalizedMessage, designDecision);

      // Convert canvas to base64
      const base64Image = canvas.toDataURL('image/png');

      return base64Image;

    } catch (error) {
      console.error('[RealPhotoEditor] Error applying design:', error.message);
      return null;
    }
  }

  /**
   * Apply photo effects (border, circular, vintage, etc.)
   */
  applyPhotoEffect(ctx, width, height, effect) {
    if (!effect || effect === 'none') return;

    if (effect === 'border') {
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 20;
      ctx.strokeRect(10, 10, width - 20, height - 20);
    } else if (effect === 'circular') {
      // Create circular mask (for profile photos)
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 50;

      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else if (effect === 'vintage') {
      // Vintage sepia effect
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(112, 66, 20, 0.3)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /**
   * Add semi-transparent overlay for text readability
   */
  addTextOverlay(ctx, width, height, design) {
    const placement = design.textPlacement;
    const overlayColor = this.hexToRgba(design.colorPalette.primary, 0.7);

    if (placement === 'bottom') {
      const gradient = ctx.createLinearGradient(0, height - 300, 0, height);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, overlayColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, height - 300, width, 300);
    } else if (placement === 'top') {
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, overlayColor);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, 300);
    } else if (placement === 'overlay') {
      ctx.fillStyle = overlayColor;
      ctx.fillRect(0, 0, width, height);
    }
  }

  /**
   * Add decorative elements (shapes, patterns)
   */
  addDecorativeElements(ctx, width, height, design) {
    const elements = design.decorativeElements || [];

    if (elements.includes('geometric-shapes')) {
      // Add some geometric shapes in corners
      ctx.fillStyle = design.colorPalette.secondary;
      ctx.fillRect(20, 20, 100, 100);
      ctx.fillRect(width - 120, height - 120, 100, 100);
    }

    if (elements.includes('gradients')) {
      // Already handled in overlay
    }

    if (elements.includes('balloons') || elements.includes('confetti')) {
      // Simple celebratory elements
      this.addCelebratoryElements(ctx, width, height, design.colorPalette);
    }
  }

  /**
   * Add celebratory elements (balloons, confetti)
   */
  addCelebratoryElements(ctx, width, height, colors) {
    // Add some colorful circles as confetti
    const confettiCount = 20;
    for (let i = 0; i < confettiCount; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = 5 + Math.random() * 10;
      const color = [colors.primary, colors.secondary, colors.text][Math.floor(Math.random() * 3)];

      ctx.fillStyle = this.hexToRgba(color, 0.6);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Add recipient name with styling
   */
  addRecipientName(ctx, width, height, name, design) {
    const fontSize = Math.floor(width / 12); // Responsive font size
    const fontFamily = this.getFontFamily(design.fontStyle);

    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = design.colorPalette.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Add text shadow for better readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    let nameY;
    if (design.namePlacement === 'top-center') {
      nameY = height * 0.2;
    } else if (design.namePlacement === 'center') {
      nameY = height * 0.5;
    } else {
      nameY = height * 0.8;
    }

    ctx.fillText(name, width / 2, nameY);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  /**
   * Add personalized message with word wrapping
   */
  addMessage(ctx, width, height, message, design) {
    const fontSize = Math.floor(width / 25); // Smaller than name
    const fontFamily = this.getFontFamily(design.fontStyle);

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = design.colorPalette.text;
    ctx.textAlign = 'center';

    // Add text shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    let messageY;
    if (design.messagePlacement === 'below-name') {
      messageY = height * 0.3;
    } else if (design.messagePlacement === 'center') {
      messageY = height * 0.6;
    } else {
      messageY = height * 0.85;
    }

    // Word wrap
    const maxWidth = width * 0.8;
    const lines = this.wrapText(ctx, message, maxWidth);
    const lineHeight = fontSize * 1.4;

    lines.forEach((line, index) => {
      ctx.fillText(line, width / 2, messageY + (index * lineHeight));
    });

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  /**
   * Wrap text to fit within maxWidth
   */
  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + ' ' + word).width;
      if (width < maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);

    return lines;
  }

  /**
   * Get font family based on style
   */
  getFontFamily(fontStyle) {
    const fonts = {
      'elegant-script': 'Georgia, serif',
      'modern-sans': 'Arial, sans-serif',
      'bold-display': 'Impact, sans-serif',
      'handwritten': 'Comic Sans MS, cursive',
      'classic-serif': 'Times New Roman, serif'
    };

    return fonts[fontStyle] || 'Arial, sans-serif';
  }

  /**
   * Convert hex color to rgba
   */
  hexToRgba(hex, alpha = 1) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Fallback designs
   */
  getFallbackDesigns(input) {
    return [
      {
        styleNumber: 1,
        styleName: 'Modern Minimal',
        description: 'Clean, elegant design',
        layout: 'photo-and-text',
        textPlacement: 'bottom',
        namePlacement: 'top-center',
        messagePlacement: 'below-name',
        fontStyle: 'modern-sans',
        colorPalette: { primary: '#000000', secondary: '#FFFFFF', text: '#FFFFFF', background: '#000000' },
        designStyle: 'minimal',
        decorativeElements: [],
        photoEffect: 'border'
      },
      {
        styleNumber: 2,
        styleName: 'Bold & Vibrant',
        description: 'Eye-catching colorful design',
        layout: 'photo-and-text',
        textPlacement: 'bottom',
        namePlacement: 'top-center',
        messagePlacement: 'below-name',
        fontStyle: 'bold-display',
        colorPalette: { primary: '#FF6B6B', secondary: '#4ECDC4', text: '#FFFFFF', background: '#FFE66D' },
        designStyle: 'bold',
        decorativeElements: ['confetti', 'balloons'],
        photoEffect: 'none'
      },
      {
        styleNumber: 3,
        styleName: 'Elegant Classic',
        description: 'Timeless sophisticated design',
        layout: 'photo-and-text',
        textPlacement: 'bottom',
        namePlacement: 'top-center',
        messagePlacement: 'below-name',
        fontStyle: 'elegant-script',
        colorPalette: { primary: '#D4AF37', secondary: '#F5F5DC', text: '#2C3E50', background: '#FFFFFF' },
        designStyle: 'elegant',
        decorativeElements: [],
        photoEffect: 'vintage'
      }
    ];
  }
}

module.exports = RealPhotoEditor;
