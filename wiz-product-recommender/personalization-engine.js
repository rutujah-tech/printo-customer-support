/**
 * WIZ Personalization Engine v3.0
 * Using @google/genai SDK for High-Fidelity Image Generation
 *
 * NOTE: Prompts are defined in prompts.js - edit that file to customize AI behavior
 */

import { GoogleGenAI } from '@google/genai';
import { getCreativePrompt, MODELS, DEFAULTS } from './prompts.js';

class PersonalizationEngine {
  constructor(config = {}) {
    this.geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    this.client = new GoogleGenAI({
      apiKey: this.geminiApiKey,
    });
  }

  async createPersonalizedFile(input) {
    const startTime = Date.now();
    try {
      console.log('[WIZ] Creating for:', input.recipientName, '| Photo:', !!input.photo);
      const result = await this.generate(input);
      return { success: true, result: { ...result, responseTime: Date.now() - startTime } };
    } catch (error) {
      console.error('[WIZ] Engine Error:', error.message);
      return { success: false, error: error.message };
    }
  }

  async generate(input) {
    const { recipientName, occasion, relationship, specialNotes, photo } = input;
    const hasPhoto = !!photo;

    // Get prompt from prompts.js - edit that file to customize creative behavior
    const prompt = getCreativePrompt({
      recipientName: recipientName || DEFAULTS.recipientName,
      occasion: occasion || DEFAULTS.occasion,
      relationship: relationship || DEFAULTS.relationship,
      specialNotes: specialNotes || DEFAULTS.specialNotes,
      hasPhoto
    });

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];

    if (hasPhoto) {
      console.log('[WIZ] Preparing image...');
      const imagePart = await this.prepareImage(photo);
      if (imagePart) {
        contents[0].parts.push(imagePart);
        console.log('[WIZ] Sending PROMPT + IMAGE to Gemini 3 Pro Image...');
      }
    } else {
      console.log('[WIZ] Sending PROMPT only to Gemini 3 Pro Image...');
    }

    const response = await this.client.models.generateContent({
      model: MODELS.creative,  // Model defined in prompts.js
      contents,
      config: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    });

    return this.parseResponse(response, recipientName, occasion, relationship);
  }

  parseResponse(response, recipientName, occasion, relationship) {
    const result = { recipientName, occasion, relationship, style: 'Quirky', copy: '', product: '', imageUrl: null };

    const candidates = response.candidates || [];
    if (candidates.length === 0) {
      console.error('[WIZ] No candidates in Gemini response');
      return result;
    }

    const parts = candidates[0].content?.parts || [];
    let textContent = '';

    for (const part of parts) {
      if (part.text) {
        textContent += part.text;
        console.log('[WIZ] Text part snippet:', part.text.substring(0, 100));
      }
      if (part.inlineData) {
        result.imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        console.log('[WIZ] Image part captured');
      }
    }

    const copyMatch = textContent.match(/\*\*THE COPY:\*\*\s*(.+?)(?:\n|$)/i);
    if (copyMatch) result.copy = copyMatch[1].trim();

    const productMatch = textContent.match(/\*\*THE PRODUCT:\*\*\s*(.+?)(?:\n|$)/i);
    if (productMatch) result.product = productMatch[1].trim();

    const styleMatch = textContent.match(/\*\*THE STYLE:\*\*\s*(.+?)(?:\n|$)/i);
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
        const ab = await res.arrayBuffer();
        base64 = Buffer.from(ab).toString('base64');
        mimeType = res.headers.get('content-type') || 'image/jpeg';
      } else {
        base64 = photo;
      }
      return { inlineData: { mimeType, data: base64 } };
    } catch (e) {
      console.error('[WIZ] Image prep error:', e.message);
      return null;
    }
  }
}

export default PersonalizationEngine;
