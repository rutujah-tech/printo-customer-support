/**
 * Gemini Gift Creator - Uses ONLY Google's Gemini for ALL tasks
 * - Text Generation: Gemini 2.0 Flash
 * - Image Generation: Gemini 2.5 Flash Image (Nano Banana)
 *
 * NO ChatGPT, NO DALL-E - 100% Gemini
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiGiftCreator {
  constructor(config = {}) {
    this.geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
  }

  /**
   * Generate complete gift concept with image using ONLY Gemini
   */
  async generateGiftConcept(config) {
    const {
      occasion,
      recipientName,
      relationship,
      specialNotes,
      customerPhoto,
      productType,
      selectedProduct,  // EXACT product selected by recommender
      productLink       // Product link from recommender
    } = config;

    try {
      console.log('[WIZ] Creating gift concept using Gemini...');

      // Build the creative prompt
      const prompt = this.buildCreativePrompt({
        occasion,
        recipientName,
        relationship,
        specialNotes,
        hasPhoto: !!customerPhoto,
        selectedProduct,  // Pass selected product to prompt
        productLink       // Pass product link to prompt
      });

      console.log('[WIZ] Calling Gemini 2.0 Flash for text generation...');

      // Use Gemini 2.0 Flash for text generation
      const textModel = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const result = await textModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('[WIZ] Gemini text response received');
      console.log('[WIZ] Response preview:', text.substring(0, 400));

      // Parse the response to extract gift concept
      const giftConcept = this.parseGeminiResponse(text);

      // Use the selected product name (not what Gemini might have suggested)
      const cleanProductName = selectedProduct ? selectedProduct.split('|')[0].trim() : 'Personalized Photo Mug';
      giftConcept.product = cleanProductName;  // Override with selected product
      giftConcept.printoLink = productLink || giftConcept.printoLink;  // Use actual product link

      // Generate image using Gemini
      console.log('[WIZ] Generating image with Gemini...');
      console.log('[WIZ] Product for image:', cleanProductName);
      const imageUrl = await this.generateImageWithGemini(giftConcept, customerPhoto);

      if (imageUrl) {
        giftConcept.imageUrl = imageUrl;
        giftConcept.imageGenerated = true;
        console.log('[WIZ] Image generated successfully');
      } else {
        console.log('[WIZ] Image generation failed');
      }

      return giftConcept;

    } catch (error) {
      console.error('[WIZ] Error:', error.message);

      // Return fallback concept
      return {
        product: productType || 'Personalized Photo Mug',
        headline: `${recipientName} - Special Gift`,
        designStyle: 'Elegant',
        description: `A personalized gift for ${occasion}`,
        imageGenerated: false,
        imageUrl: null,
        fallback: true
      };
    }
  }

  /**
   * Build the WIZ creative prompt (includes system role for Gemini)
   */
  buildCreativePrompt(input) {
    const { occasion, recipientName, relationship, specialNotes, hasPhoto, selectedProduct, productLink } = input;

    // Extract clean product name for display
    const cleanProductName = selectedProduct ? selectedProduct.split('|')[0].trim() : 'Personalized Photo Mug';

    const prompt = `SYSTEM ROLE:
You are WIZ, the Creative Director, Senior Print Designer, and Photo Editor for Printo (www.printo.in).
You think like a real Printo designer whose job is to reduce customer effort to zero and deliver a FINAL, READY-TO-PRINT personalized gift.
You behave like a premium D2C brand designer working for WhatsApp-first gifting.
You make all creative decisions yourself. Do NOT ask questions. Do NOT give multiple options.

OBJECTIVE:
Create ONE complete personalized Printo gift that can be immediately shown to the customer on WhatsApp.

INPUT DETAILS:
- Occasion: ${occasion}
- Recipient Name: ${recipientName}
- Relationship: ${relationship}
- Special Backstory: ${specialNotes}
- Customer Photo: ${hasPhoto ? 'YES - PROVIDED' : 'NO'}

⚠️ PRODUCT ALREADY SELECTED (DO NOT CHANGE):
- Product: ${cleanProductName}
- Link: ${productLink || 'https://www.printo.in'}

CREATIVE DECISION RULES:

1. PRODUCT (ALREADY SELECTED - DO NOT CHANGE):
- ⚠️ The product has ALREADY been selected: "${cleanProductName}"
- You MUST use this EXACT product - DO NOT suggest a different product
- DO NOT recommend Mug if the selected product is Frame, etc.
- ALL your design work must be for: "${cleanProductName}"

2. COPY / MESSAGE (MOST IMPORTANT):
- Write ONE punchy Hinglish line (MAX 8 WORDS).
- Use simple Hindi + English mix.
- Base it on famous Hindi movie titles or dialogues with a clever twist.
- Must include "${recipientName}" or clearly reference them.
- Must emotionally connect to the special backstory.
- NO cheesy quotes. NO generic wishes.

3. IMAGE BEHAVIOR (NON-NEGOTIABLE - CRITICAL):
${hasPhoto ? `- Customer photo IS PROVIDED
- ⚠️ The uploaded photo MUST appear DIRECTLY ON the product surface
- ⚠️ Photo must be PRINTED ON the product (mug/frame/cushion/canvas) - NOT in background
- DO NOT generate a new face - use ONLY the uploaded photo
- DO NOT place photo on any object other than the selected product
- Preserve real skin texture, lighting, and identity
- If photo not visible ON the product = OUTPUT IS INVALID` : `- NO photo is provided
- Create a HIGH-END typography or illustration-only design
- NO human faces
- NO AI-generated people
- Focus on beautiful fonts, colors, abstract shapes`}

OUTPUT FORMAT (STRICT - respond ONLY in this format):

**THE PRODUCT:** ${cleanProductName}

**THE HEADLINE:** [Hinglish line – max 8 words]

**THE DESIGN STYLE:** [Modern/Elegant/Minimalist/Vintage]

**DESCRIPTION:** [2 sentences about the visual concept for ${cleanProductName}]

${hasPhoto ? `**IMAGE INTEGRATION:** [Describe how customer photo appears ON the ${cleanProductName} surface]` : '**VISUAL ELEMENTS:** [Typography and design elements used - NO faces]'}

**PRINTO LINK:** ${productLink || 'https://www.printo.in'}

⚠️ VALIDATION: You MUST design for "${cleanProductName}" only. The mockup MUST show ${cleanProductName} with ${hasPhoto ? 'customer photo PRINTED ON IT' : 'typography design'}.`;

    return prompt;
  }

  /**
   * Parse Gemini's response to extract gift concept
   */
  parseGeminiResponse(text) {
    const concept = {
      product: '',
      headline: '',
      designStyle: '',
      description: '',
      imageIntegration: '',
      printoLink: '',
      fullResponse: text
    };

    // Extract product
    const productMatch = text.match(/\*\*THE PRODUCT:\*\*\s*(.+?)(?:\n|$)/i);
    if (productMatch) concept.product = productMatch[1].trim();

    // Extract headline
    const headlineMatch = text.match(/\*\*THE HEADLINE:\*\*\s*(.+?)(?:\n|$)/i);
    if (headlineMatch) concept.headline = headlineMatch[1].trim();

    // Extract design style
    const styleMatch = text.match(/\*\*THE DESIGN STYLE:\*\*\s*(.+?)(?:\n|$)/i);
    if (styleMatch) concept.designStyle = styleMatch[1].trim();

    // Extract description
    const descMatch = text.match(/\*\*DESCRIPTION:\*\*\s*(.+?)(?:\n\*\*|$)/is);
    if (descMatch) concept.description = descMatch[1].trim();

    // Extract image integration or visual elements
    const imageMatch = text.match(/\*\*IMAGE INTEGRATION:\*\*\s*(.+?)(?:\n\*\*|$)/is);
    const visualMatch = text.match(/\*\*VISUAL ELEMENTS:\*\*\s*(.+?)(?:\n\*\*|$)/is);
    if (imageMatch) concept.imageIntegration = imageMatch[1].trim();
    else if (visualMatch) concept.imageIntegration = visualMatch[1].trim();

    // Extract Printo link
    const linkMatch = text.match(/\*\*PRINTO LINK:\*\*\s*(.+?)(?:\n|$)/i);
    if (linkMatch) concept.printoLink = linkMatch[1].trim();

    return concept;
  }

  /**
   * Generate actual image using Gemini Nano Banana (Image Generation Model)
   * WIZ Style: Premium D2C brand designer output
   *
   * CRITICAL RULES:
   * 1. Customer photo MUST appear ON the product (not in background)
   * 2. Product in image MUST match the recommended product exactly
   * 3. This is the FINAL customer preview - must be print-ready
   */
  async generateImageWithGemini(concept, customerPhoto) {
    try {
      const hasPhoto = !!customerPhoto;
      const productName = concept.product || 'Personalized Photo Mug';

      // Build image generation prompt
      const productMaterial = this.getProductMaterial(productName);

      let geminiPrompt;

      if (hasPhoto) {
        geminiPrompt = `Create a professional product mockup photograph of a ${productName}.

PRODUCT: ${productName}
TEXT ON PRODUCT: "${concept.headline}"

INSTRUCTIONS:
1. Show the ${productName} on a clean white background
2. Place the provided photo directly ON the product surface (printed on it)
3. The photo should look naturally printed on the ${productMaterial} surface
4. Add the text "${concept.headline}" as printed text on the product
5. Use professional studio lighting
6. 45-degree camera angle showing the product clearly

STYLE: Clean e-commerce product photography, white background, professional lighting.`;
      } else {
        geminiPrompt = `Create a professional product mockup photograph of a ${productName}.

PRODUCT: ${productName}
TEXT ON PRODUCT: "${concept.headline}"

INSTRUCTIONS:
1. Show the ${productName} on a clean white background
2. Create an elegant typography design on the product surface
3. Display "${concept.headline}" as the main text, printed on the product
4. Use professional studio lighting
5. 45-degree camera angle showing the product clearly
6. No human faces or figures

STYLE: Clean e-commerce product photography, white background, professional lighting.`;
      }

      console.log('[WIZ] Using Gemini for image generation...');
      console.log('[WIZ] Customer photo provided:', hasPhoto ? 'YES' : 'NO');

      // Use Gemini 2.5 Flash Image for image generation (Nano Banana)
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT']
        }
      });
      console.log('[WIZ] Model: gemini-2.5-flash-image (Nano Banana)');

      let result;

      if (hasPhoto) {
        // ACTUALLY PASS THE CUSTOMER PHOTO TO GEMINI
        console.log('[WIZ] Passing customer photo to Gemini for integration...');

        // Prepare the image data for Gemini
        const imageParts = await this.prepareImageForGemini(customerPhoto);

        if (imageParts) {
          console.log('[WIZ] Image prepared, mimeType:', imageParts.inlineData?.mimeType);
          console.log('[WIZ] Image data length:', imageParts.inlineData?.data?.length || 0);

          // Send both prompt and image to Gemini
          result = await model.generateContent({
            contents: [{
              role: 'user',
              parts: [
                { text: geminiPrompt },
                imageParts
              ]
            }]
          });
          console.log('[WIZ] Sent prompt + customer photo to Gemini');
        } else {
          // Fallback to text-only if image prep fails
          console.log('[WIZ] Image prep failed, using text-only prompt');
          result = await model.generateContent(geminiPrompt);
        }
      } else {
        // No photo - text-only generation
        result = await model.generateContent(geminiPrompt);
      }

      const response = await result.response;
      console.log('[WIZ] Gemini response received');

      // Extract image from response
      if (response.candidates && response.candidates[0]) {
        const parts = response.candidates[0].content?.parts || [];
        console.log('[WIZ] Response parts count:', parts.length);

        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            // Convert base64 to data URL
            const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            console.log('[WIZ] Image generated successfully, size:', part.inlineData.data.length);
            return imageUrl;
          }
          if (part.text) {
            console.log('[WIZ] Text response:', part.text.substring(0, 200));
          }
        }
      } else {
        console.log('[WIZ] No candidates in response');
        if (response.promptFeedback) {
          console.log('[WIZ] Prompt feedback:', JSON.stringify(response.promptFeedback));
        }
      }

      console.log('[WIZ] No image data in Gemini response');
      return null;

    } catch (error) {
      console.error('[WIZ] Gemini image error:', error.message);
      return null;
    }
  }

  /**
   * Generate SINGLE design (not multiple variations)
   * Returns array with 1 item for backward compatibility
   */
  async generateMultipleVariations(config) {
    console.log('[GeminiGiftCreator] Generating SINGLE gift concept (not multiple)...');

    const concept = await this.generateGiftConcept(config);

    // Return as array with single item for compatibility
    return [{
      styleNumber: 1,
      styleName: concept.designStyle || 'Elegant',
      ...concept
    }];
  }

  /**
   * Prepare customer photo for Gemini API
   * Handles: base64 data URLs, URLs, file paths
   */
  async prepareImageForGemini(customerPhoto) {
    try {
      let base64Data;
      let mimeType = 'image/jpeg';

      if (typeof customerPhoto === 'string') {
        // Case 1: Already a base64 data URL (data:image/jpeg;base64,...)
        if (customerPhoto.startsWith('data:')) {
          const matches = customerPhoto.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
            console.log('[WIZ] Photo format: base64 data URL');
          }
        }
        // Case 2: HTTP/HTTPS URL - need to fetch and convert
        else if (customerPhoto.startsWith('http://') || customerPhoto.startsWith('https://')) {
          console.log('[WIZ] Photo format: URL - fetching...');
          try {
            const response = await fetch(customerPhoto);
            const arrayBuffer = await response.arrayBuffer();
            base64Data = Buffer.from(arrayBuffer).toString('base64');

            // Detect mime type from URL or response
            const contentType = response.headers.get('content-type');
            if (contentType) {
              mimeType = contentType.split(';')[0];
            } else if (customerPhoto.includes('.png')) {
              mimeType = 'image/png';
            } else if (customerPhoto.includes('.webp')) {
              mimeType = 'image/webp';
            }
            console.log('[WIZ] Photo fetched successfully, mime:', mimeType);
          } catch (fetchError) {
            console.error('[WIZ] Failed to fetch photo URL:', fetchError.message);
            return null;
          }
        }
        // Case 3: Raw base64 string (without data: prefix)
        else if (customerPhoto.length > 100 && !customerPhoto.includes('/')) {
          base64Data = customerPhoto;
          console.log('[WIZ] Photo format: raw base64 string');
        }
        // Case 4: File path - read file
        else {
          console.log('[WIZ] Photo format: file path - reading...');
          try {
            const fs = require('fs');
            const path = require('path');

            if (fs.existsSync(customerPhoto)) {
              const fileBuffer = fs.readFileSync(customerPhoto);
              base64Data = fileBuffer.toString('base64');

              // Detect mime type from extension
              const ext = path.extname(customerPhoto).toLowerCase();
              if (ext === '.png') mimeType = 'image/png';
              else if (ext === '.webp') mimeType = 'image/webp';
              else if (ext === '.gif') mimeType = 'image/gif';
              console.log('[WIZ] Photo read from file, mime:', mimeType);
            } else {
              console.error('[WIZ] Photo file not found:', customerPhoto);
              return null;
            }
          } catch (fileError) {
            console.error('[WIZ] Failed to read photo file:', fileError.message);
            return null;
          }
        }
      }
      // Case 5: Already an object with base64 data
      else if (customerPhoto && typeof customerPhoto === 'object') {
        if (customerPhoto.base64) {
          base64Data = customerPhoto.base64;
          mimeType = customerPhoto.mimeType || 'image/jpeg';
          console.log('[WIZ] Photo format: object with base64');
        } else if (customerPhoto.data) {
          base64Data = customerPhoto.data;
          mimeType = customerPhoto.mimeType || 'image/jpeg';
          console.log('[WIZ] Photo format: object with data');
        }
      }

      if (!base64Data) {
        console.error('[WIZ] Could not extract base64 data from customer photo');
        return null;
      }

      // Return in Gemini's expected format
      return {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      };

    } catch (error) {
      console.error('[WIZ] Error preparing image for Gemini:', error.message);
      return null;
    }
  }

  /**
   * Get specific 3D coordinates and DISPLACEMENT instructions for each product type
   * Includes: Cylindrical Warping for drinkware, Fabric Displacement for soft goods
   */
  getProductCoordinates(productName) {
    const name = (productName || '').toLowerCase();

    // DRINKWARE - Cylindrical Warping
    if (name.includes('mug')) {
      return `PRODUCT TYPE: Ceramic Mug (DRINKWARE)
DISPLACEMENT TECHNIQUE: CYLINDRICAL WARPING

=== CYLINDRICAL WARPING PARAMETERS ===
- WRAP ANGLE: 8-12° barrel distortion around cylinder axis
- HORIZONTAL STRETCH: Photo stretches at edges to wrap around cylinder
- VERTICAL COMPRESSION: Slight vertical squeeze at left/right edges
- AXIS: Vertical cylinder axis (mug standing upright)
- WRAP DIRECTION: Photo wraps LEFT-to-RIGHT around mug body

=== PHOTO ZONE ===
- POSITION: Center of mug body (horizontal center, vertical middle)
- WIDTH: 60% of visible mug circumference
- HEIGHT: 70% of mug body height (below rim, above base)

=== TEXTURE MAPPING ===
- MATERIAL: Glossy ceramic with subtle reflection
- TEXTURE: Fine ceramic grain (barely visible)
- REFLECTION: Subtle highlight streak following cylinder curve
- CONTACT SHADOW: 1px soft shadow at photo edges on ceramic

=== SURFACE PROPERTIES ===
- BASE COLOR: White/cream ceramic
- GLOSS LEVEL: Medium-high (30-50% reflectivity)
- HANDLE: Visible on right side, photo does NOT wrap onto handle`;
    }

    // DRINKWARE - Cylindrical Warping (Bottles)
    if (name.includes('bottle') || name.includes('sipper') || name.includes('tumbler')) {
      return `PRODUCT TYPE: Water Bottle/Sipper/Tumbler (DRINKWARE)
DISPLACEMENT TECHNIQUE: CYLINDRICAL WARPING

=== CYLINDRICAL WARPING PARAMETERS ===
- WRAP ANGLE: 15-20° barrel distortion (tighter curve than mug)
- HORIZONTAL STRETCH: Significant stretch at edges for narrow cylinder
- VERTICAL COMPRESSION: More pronounced at edges due to smaller diameter
- AXIS: Vertical cylinder axis (bottle standing upright)
- WRAP DIRECTION: Photo wraps around bottle body seamlessly

=== PHOTO ZONE ===
- POSITION: Center of bottle body, middle third height
- WIDTH: 50% of visible circumference
- HEIGHT: 40% of bottle body height

=== TEXTURE MAPPING ===
- MATERIAL: Stainless steel (brushed or matte) OR plastic
- TEXTURE: Fine brushed metal grain OR smooth plastic
- REFLECTION: Metal highlight following cylinder curve
- CONTACT SHADOW: 1-2px soft shadow at photo edges

=== SURFACE PROPERTIES ===
- BASE COLOR: Silver/white/black metal or colored plastic
- GLOSS LEVEL: High for metal (50-70%), medium for plastic
- CAP: Visible lid/cap at top, separate from print area`;
    }

    // SOFT GOODS - Fabric Displacement
    if (name.includes('cushion') || name.includes('pillow')) {
      return `PRODUCT TYPE: Square Cushion/Pillow (SOFT GOODS)
DISPLACEMENT TECHNIQUE: FABRIC DISPLACEMENT

=== FABRIC DISPLACEMENT PARAMETERS ===
- BULGE: Convex outward bulge (3-8° from flat) simulating stuffed cushion
- WRINKLE MAP: Subtle fabric wrinkles radiating from center
- EDGE DROOP: Slight downward curve at cushion edges
- SURFACE NORMALS: Photo follows the soft, organic surface shape

=== PHOTO ZONE ===
- POSITION: Center of cushion front face
- WIDTH: 80% of cushion width
- HEIGHT: 80% of cushion height

=== TEXTURE MAPPING ===
- MATERIAL: Fabric (polyester/cotton blend)
- TEXTURE: Visible fabric weave pattern overlaid on photo
- WEAVE TYPE: Fine cross-hatch weave (barely visible but present)
- CONTACT SHADOW: Soft shadow in fabric creases near photo edges

=== SURFACE PROPERTIES ===
- BASE: White/cream fabric base
- GLOSS LEVEL: Low (matte fabric, 5-15% reflectivity)
- EDGES: Visible fabric seam around cushion perimeter
- STUFFING: Photo surface shows subtle pillow stuffing contours`;
    }

    // FLAT PRODUCTS - Minimal Displacement
    if (name.includes('frame') || name.includes('led')) {
      return `PRODUCT TYPE: Photo Frame (FLAT SURFACE)
DISPLACEMENT TECHNIQUE: PLANAR WITH GLASS REFLECTION

=== DISPLACEMENT PARAMETERS ===
- CURVATURE: Flat (0°) - photo sits on flat plane behind glass
- GLASS LAYER: Subtle reflection/glare on glass surface
- DEPTH: Photo recessed 2-3mm behind glass

=== PHOTO ZONE ===
- POSITION: Center of frame opening
- WIDTH: Frame inner width minus mat/border
- HEIGHT: Frame inner height minus mat/border

=== TEXTURE MAPPING ===
- MATERIAL: Matte or glossy photo paper behind glass
- TEXTURE: Smooth photo paper (no grain on photo)
- GLASS: Subtle reflection streak across surface
- CONTACT SHADOW: Shadow under frame edges on background

=== SURFACE PROPERTIES ===
- FRAME MATERIAL: Wood/metal/plastic visible border
- GLASS: Clear with subtle reflection
- MAT: White mat border around photo if applicable`;
    }

    // CANVAS - Fabric Texture
    if (name.includes('canvas')) {
      return `PRODUCT TYPE: Canvas Print (FABRIC SURFACE)
DISPLACEMENT TECHNIQUE: CANVAS TEXTURE DISPLACEMENT

=== DISPLACEMENT PARAMETERS ===
- SURFACE: Slight canvas weave texture across entire surface
- STRETCH: Photo spans stretched canvas (minimal bulge)
- EDGES: Gallery wrap - photo continues around canvas edges

=== PHOTO ZONE ===
- POSITION: Entire canvas front surface
- WIDTH: 100% of canvas width
- HEIGHT: 100% of canvas height

=== TEXTURE MAPPING ===
- MATERIAL: Canvas fabric (cotton/polyester blend)
- TEXTURE: Visible canvas weave pattern overlaid on photo
- WEAVE TYPE: Canvas cross-weave (more visible than cushion)
- CONTACT SHADOW: Shadow under canvas on wall/surface

=== SURFACE PROPERTIES ===
- GLOSS LEVEL: Matte to satin (10-30% reflectivity)
- FRAME: Visible wood stretcher bars on edges
- DEPTH: 1.5-2 inch canvas depth visible from angle`;
    }

    if (name.includes('magnet') || name.includes('fridge')) {
      return `PRODUCT TYPE: Fridge Magnet (FLAT RIGID)
DISPLACEMENT TECHNIQUE: FLAT WITH EDGE THICKNESS

=== DISPLACEMENT PARAMETERS ===
- CURVATURE: Flat (0°) with rounded corners
- THICKNESS: 2-3mm edge thickness visible
- CORNERS: Slightly rounded (2-3mm radius)

=== PHOTO ZONE ===
- POSITION: Center of magnet
- WIDTH: 95% of magnet width
- HEIGHT: 95% of magnet height

=== TEXTURE MAPPING ===
- MATERIAL: Glossy laminated photo surface
- TEXTURE: Smooth glossy finish (no texture)
- CONTACT SHADOW: 2px shadow under magnet showing thickness`;
    }

    if (name.includes('diary') || name.includes('notebook')) {
      return `PRODUCT TYPE: Diary/Notebook Cover (RIGID + CURVE)
DISPLACEMENT TECHNIQUE: BOOK SPINE DISPLACEMENT

=== DISPLACEMENT PARAMETERS ===
- SPINE CURVE: Slight curve along left edge (spine)
- COVER FLAT: Mostly flat front cover surface
- PAGE THICKNESS: Visible page edges on right side

=== PHOTO ZONE ===
- POSITION: Center of cover width, upper 60%
- WIDTH: 70% of cover width
- HEIGHT: 50% of cover height

=== TEXTURE MAPPING ===
- MATERIAL: Leather or matte laminate
- TEXTURE: Leather grain or smooth laminate finish
- CONTACT SHADOW: Shadow under cover on surface`;
    }

    if (name.includes('calendar')) {
      return `PRODUCT TYPE: Wall/Desk Calendar (PAPER)
DISPLACEMENT TECHNIQUE: PAPER CURL DISPLACEMENT

=== DISPLACEMENT PARAMETERS ===
- PAGE CURL: Slight curl at top/bottom edges
- HANGING: If wall calendar, slight bow from hanging
- PAGES: Visible page thickness at top

=== PHOTO ZONE ===
- POSITION: Center width, upper 65%
- WIDTH: 90% of calendar width
- HEIGHT: 55% of calendar height

=== TEXTURE MAPPING ===
- MATERIAL: Matte or glossy paper
- TEXTURE: Smooth paper with subtle fiber
- CONTACT SHADOW: Shadow from page edges`;
    }

    if (name.includes('card')) {
      return `PRODUCT TYPE: Greeting Card (PAPER/CARD)
DISPLACEMENT TECHNIQUE: CARDSTOCK DISPLACEMENT

=== DISPLACEMENT PARAMETERS ===
- FOLD: Visible fold line if standing (tent card)
- THICKNESS: 300-400gsm cardstock thickness visible
- CORNERS: Slight curl at corners possible

=== PHOTO ZONE ===
- POSITION: Center or upper half of card front
- WIDTH: 70% of card width
- HEIGHT: 60% of card height

=== TEXTURE MAPPING ===
- MATERIAL: Matte or glossy cardstock
- TEXTURE: Smooth or lightly textured cardstock
- CONTACT SHADOW: Shadow under card on surface`;
    }

    if (name.includes('puzzle') || name.includes('jigsaw')) {
      return `PRODUCT TYPE: Photo Puzzle (FLAT + SEAMS)
DISPLACEMENT TECHNIQUE: PUZZLE PIECE DISPLACEMENT

=== DISPLACEMENT PARAMETERS ===
- PIECE LINES: Subtle puzzle cut lines across photo
- PIECE DEPTH: Tiny shadow at each puzzle piece edge
- SURFACE: Flat overall, slight piece separation visible

=== PHOTO ZONE ===
- POSITION: Entire puzzle surface
- WIDTH: 100% of puzzle width
- HEIGHT: 100% of puzzle height

=== TEXTURE MAPPING ===
- MATERIAL: Matte cardboard/chipboard
- TEXTURE: Smooth matte surface
- PIECE EDGES: Visible interlocking piece outlines`;
    }

    // Default for unknown products
    return `PRODUCT TYPE: ${productName}
DISPLACEMENT TECHNIQUE: SURFACE-APPROPRIATE DISPLACEMENT

=== DISPLACEMENT PARAMETERS ===
- CURVATURE: Match product surface geometry
- CONTACT SHADOW: 1-2px soft shadow at photo edges

=== PHOTO ZONE ===
- POSITION: Center of product front surface
- WIDTH: 70% of product width
- HEIGHT: 70% of product height

=== TEXTURE MAPPING ===
- MATERIAL: Product-appropriate material
- TEXTURE: Apply appropriate material texture overlay`;
  }

  /**
   * Get product material for texture overlay description
   */
  getProductMaterial(productName) {
    const name = (productName || '').toLowerCase();

    if (name.includes('mug')) return 'glossy ceramic';
    if (name.includes('bottle') || name.includes('sipper') || name.includes('tumbler')) return 'brushed stainless steel';
    if (name.includes('cushion') || name.includes('pillow')) return 'fabric weave';
    if (name.includes('canvas')) return 'canvas weave';
    if (name.includes('frame')) return 'photo paper behind glass';
    if (name.includes('diary') || name.includes('notebook')) return 'leather/laminate';
    if (name.includes('calendar')) return 'matte paper';
    if (name.includes('card')) return 'cardstock';
    if (name.includes('magnet')) return 'glossy laminate';
    if (name.includes('puzzle')) return 'matte cardboard';
    if (name.includes('t-shirt') || name.includes('tshirt')) return 'cotton fabric';

    return 'printed surface';
  }

  /**
   * Get smart product suggestion based on occasion + relationship
   */
  getSmartProductSuggestion(occasion, relationship) {
    const occ = (occasion || '').toLowerCase();
    const rel = (relationship || '').toLowerCase();

    // Romantic occasions
    if (occ.includes('valentine') || rel.includes('girlfriend') || rel.includes('boyfriend') || rel.includes('wife') || rel.includes('husband')) {
      return 'Personalized Photo Mug or Heart-Shaped Cushion or A3 Canvas Print';
    }
    // Birthday
    if (occ.includes('birthday')) {
      return 'Personalized Photo Mug or A3 Matte Framed Print or Photo Calendar';
    }
    // Anniversary
    if (occ.includes('anniversary')) {
      return 'A3 Canvas Print or Photo Album or Premium Photo Frame';
    }
    // Friendship
    if (rel.includes('friend') || occ.includes('friendship')) {
      return 'Personalized Photo Mug or Photo Collage Frame or Photo Cushion';
    }
    // Family
    if (rel.includes('mother') || rel.includes('father') || rel.includes('sister') || rel.includes('brother')) {
      return 'Premium Photo Frame or Photo Calendar or Personalized Mug';
    }
    // Default
    return 'Personalized Photo Mug or A3 Framed Print or Photo Calendar';
  }
}

module.exports = GeminiGiftCreator;
