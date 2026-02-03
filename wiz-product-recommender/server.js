/**
 * WIZ - Personalized Gift Generator
 * BotSpace WhatsApp Integration
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const PersonalizationEngine = require('./personalization-engine');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3007;

const wizEngine = new PersonalizationEngine({ geminiApiKey: process.env.GEMINI_API_KEY });

// Store sessions by phone (in-memory)
const sessions = new Map();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Fetch image from URL
async function fetchImageAsBase64(imageUrl) {
  if (!imageUrl || imageUrl.toLowerCase() === 'no' || imageUrl.toLowerCase() === 'skip') return null;
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.error('[WIZ] Failed to fetch image:', err.message);
    return null;
  }
}

// Normalize requirement to a string (handles object, string, undefined)
function normalizeRequirement(requirement) {
  // Handle undefined/null
  if (requirement == null) {
    return '';
  }

  // Handle object with url property (e.g., { url: "https://...", mime_type: "image/jpeg" })
  if (typeof requirement === 'object') {
    // Try common URL field names
    const url = requirement.url || requirement.image_url || requirement.mediaUrl || requirement.media_url;
    if (url && typeof url === 'string') {
      return url.trim();
    }
    // If object but no URL found, stringify for logging
    console.log('[WIZ] Requirement is object without URL:', JSON.stringify(requirement));
    return '';
  }

  // Handle string
  if (typeof requirement === 'string') {
    return requirement.trim();
  }

  // Fallback: convert to string
  return String(requirement).trim();
}

// Parse customer data string
function parseCustomerData(dataString) {
  // Try to parse as "Name: X, Occasion: Y, Relationship: Z, Special: W"
  // Or just split by newlines/commas
  const data = {};
  const parts = dataString.split(/[,\n]+/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.toLowerCase().includes('name') || trimmed.toLowerCase().includes('who')) {
      data.recipientName = trimmed.split(':').pop()?.trim() || trimmed;
    } else if (trimmed.toLowerCase().includes('occasion')) {
      data.occasion = trimmed.split(':').pop()?.trim() || trimmed;
    } else if (trimmed.toLowerCase().includes('relation')) {
      data.relationship = trimmed.split(':').pop()?.trim() || trimmed;
    } else if (trimmed.toLowerCase().includes('special') || trimmed.toLowerCase().includes('makes')) {
      data.specialNotes = trimmed.split(':').pop()?.trim() || trimmed;
    }
  }

  // If parsing failed, use raw string as specialNotes
  if (!data.recipientName && !data.occasion) {
    data.rawData = dataString;
  }

  return data;
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Web form endpoint
app.post('/api/personalize', async (req, res) => {
  try {
    const { recipientName, occasion, relationship, specialNotes, photo } = req.body;
    if (!recipientName || !occasion || !relationship || !specialNotes) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const result = await wizEngine.createPersonalizedFile({ recipientName, occasion, relationship, specialNotes, photo: photo || null });
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/botspace/webhook
 *
 * Call 1 (customer data):
 * { "phone": "919xxx", "name": "User", "requirement": "Name: Priya, Occasion: Birthday...", "timestamp": "..." }
 *
 * Call 2 (photo):
 * { "phone": "919xxx", "name": "User", "requirement": "https://image.url" OR "NO", "timestamp": "..." }
 *
 * RESPONSE:
 * { "success": true, "message": "...", "copy": "...", "image_url": "..." }
 */
app.post('/api/botspace/webhook', async (req, res) => {
  console.log('\n[BOTSPACE] Webhook received:', JSON.stringify(req.body));

  try {
    const { phone, name, requirement: rawRequirement, timestamp } = req.body;

    // Normalize requirement (handles string, object, undefined)
    const requirement = normalizeRequirement(rawRequirement);
    console.log(`[BOTSPACE] Normalized requirement: "${requirement}" (original type: ${typeof rawRequirement})`);

    if (!phone) {
      return res.json({ success: false, message: 'Missing phone number' });
    }

    if (!requirement) {
      return res.json({ success: false, message: 'Missing or empty requirement' });
    }

    // Check if requirement is a photo URL or "NO" (safe string checks)
    const requirementLower = requirement.toLowerCase();
    const isPhotoCall = requirement.startsWith('http') ||
                        requirementLower === 'no' ||
                        requirementLower === 'skip';

    if (!isPhotoCall) {
      // CALL 1: Save customer data
      console.log(`[BOTSPACE] Call 1 - Saving data for ${phone}`);

      const parsed = parseCustomerData(requirement);
      sessions.set(phone, {
        ...parsed,
        rawRequirement: requirement,
        name,
        timestamp: Date.now()
      });

      return res.json({
        success: true,
        message: 'Got it! Now please share a photo or type "NO" to skip.',
        status: 'awaiting_photo'
      });
    }

    // CALL 2: Generate with photo
    console.log(`[BOTSPACE] Call 2 - Generating for ${phone}`);

    const session = sessions.get(phone);
    if (!session) {
      return res.json({
        success: false,
        message: 'Please start again. Send your gift details first.'
      });
    }

    // Fetch photo if URL
    let photo = null;
    if (requirement.startsWith('http')) {
      console.log(`[BOTSPACE] Fetching photo: ${requirement}`);
      photo = await fetchImageAsBase64(requirement);
    }

    // Generate
    const result = await wizEngine.createPersonalizedFile({
      recipientName: session.recipientName || session.name || 'Friend',
      occasion: session.occasion || 'Special Day',
      relationship: session.relationship || 'Friend',
      specialNotes: session.specialNotes || session.rawRequirement || 'Make it special',
      photo
    });

    // Clear session
    sessions.delete(phone);

    if (result.success) {
      console.log('[BOTSPACE] Success!');
      return res.json({
        success: true,
        message: '🎁 Your personalized gift is ready!',
        copy: result.result.copy || '',
        style: result.result.style || '',
        image_url: result.result.imageUrl || null
      });
    } else {
      return res.json({ success: false, message: 'Failed to create design. Try again.' });
    }

  } catch (error) {
    console.error('[BOTSPACE] Error:', error.message);
    return res.json({ success: false, message: 'Error: ' + error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'WIZ', version: '2.2' });
});

app.listen(PORT, () => console.log(`[WIZ] Running on port ${PORT}`));
