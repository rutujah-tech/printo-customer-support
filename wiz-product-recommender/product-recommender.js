/**
 * Product Recommendation Engine
 *
 * CLEAN IMPLEMENTATION - Uses ONLY Google Sheets data
 * NO old logic, NO hardcoded rules, NO embeddings
 *
 * Input: Single string from Botspace (e.g., "Valentine's gift for my girlfriend around ₹1500")
 * Output: Multiple product recommendations with one highlighted as BEST
 */

const OpenAI = require('openai');
const GoogleSheetsProductLoader = require('./google-sheets-loader');

class ProductRecommender {
  constructor(config = {}) {
    this.openai = config.openai;
    this.productsLoader = new GoogleSheetsProductLoader(config.googleSheets);
    this.products = [];
  }

  /**
   * Initialize - Load products from Google Sheets
   */
  async initialize(forceRefresh = false) {
    console.log('[Recommender] Initializing...');
    this.products = await this.productsLoader.loadProducts(forceRefresh);
    console.log(`[Recommender] Ready with ${this.products.length} products`);
  }

  /**
   * Parse customer input using GPT
   */
  async parseInput(input) {
    const prompt = `Extract gift requirements from this customer input:

Input: "${input}"

Return ONLY valid JSON with these fields:
{
  "occasion": "Birthday|Valentine|Anniversary|Raksha Bandhan|Diwali|Wedding|Holi|etc.",
  "relation": "Girlfriend|Boyfriend|Wife|Husband|Friend|Sister|Brother|Mother|Father|Colleague|etc.",
  "budget": number (extract from ₹1500, 1000-2000, around 500, etc. Use middle value for ranges),
  "keywords": ["keyword1", "keyword2"] (extract interests, preferences, hobbies from input),
  "giftType": "Personal|Professional|Corporate" (infer from relation and occasion)
}

Examples:
- "Valentine's gift for my girlfriend around ₹1500" -> {"occasion": "Valentine", "relation": "Girlfriend", "budget": 1500, "keywords": ["romantic", "personal"], "giftType": "Personal"}
- "Gift for my sister for Raksha Bandhan budget is around 1500-2000" -> {"occasion": "Raksha Bandhan", "relation": "Sister", "budget": 1750, "keywords": ["sister", "festive"], "giftType": "Personal"}
- "Corporate gift for colleague, budget ₹500" -> {"occasion": "Corporate", "relation": "Colleague", "budget": 500, "keywords": ["professional"], "giftType": "Corporate"}

Return ONLY the JSON, nothing else.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You extract structured gift data from text. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      });

      const parsed = JSON.parse(response.choices[0].message.content.trim());

      return {
        occasion: parsed.occasion || 'General',
        relation: parsed.relation || 'Friend',
        budget: parsed.budget || 1000,
        keywords: parsed.keywords || [],
        giftType: parsed.giftType || 'Personal',
        originalInput: input
      };

    } catch (error) {
      console.error('[Recommender] Parse error:', error);
      // Fallback parsing
      return {
        occasion: 'General',
        relation: 'Friend',
        budget: 1000,
        keywords: [],
        giftType: 'Personal',
        originalInput: input
      };
    }
  }

  /**
   * Filter and score products based on parsed requirements
   * IMPROVED: Better variety, considers ALL product types, respects budget
   */
  filterAndScoreProducts(parsedInput) {
    const { occasion, relation, budget, keywords, giftType } = parsedInput;

    // Budget range: Allow products from 30% to 200% of budget for variety
    const minPrice = budget * 0.3;
    const maxPrice = budget * 2.0;

    // Filter by availability AND budget range
    let candidates = this.products.filter(p => {
      const inStock = p.availability === 'in_Stock';
      const inBudget = p.price >= minPrice && p.price <= maxPrice;
      return inStock && inBudget;
    });

    // If too few products in budget range, expand search
    if (candidates.length < 20) {
      candidates = this.products.filter(p => p.availability === 'in_Stock');
      console.log(`[Recommender] Expanded search - ${candidates.length} in-stock products (budget range too narrow)`);
    } else {
      console.log(`[Recommender] Searching ${candidates.length} products in budget range ₹${Math.round(minPrice)}-₹${Math.round(maxPrice)}`);
    }

    // Define gift-appropriate categories for different occasions/relations
    const giftCategories = {
      personal: ['mugs', 'calendar', 'frame', 'album', 'diary', 'notebook', 'hamper', 'gift', 'cushion', 'bottle', 'sipper'],
      romantic: ['mug', 'frame', 'cushion', 'calendar', 'album', 'hamper', 'gift', 'couple', 'love'],
      festive: ['hamper', 'gift', 'calendar', 'diary', 'mug', 'celebration'],
      professional: ['diary', 'notebook', 'pen', 'business', 'award', 'trophy', 'plaque'],
      family: ['frame', 'album', 'calendar', 'hamper', 'gift', 'mug'],
      birthday: ['mug', 'frame', 'calendar', 'hamper', 'gift', 'celebration', 'party'],
      anniversary: ['frame', 'album', 'cushion', 'mug', 'couple', 'calendar', 'hamper'],
      wedding: ['frame', 'album', 'hamper', 'gift', 'couple'],
      rakhi: ['mug', 'frame', 'diary', 'hamper', 'gift', 'brother', 'sister']
    };

    // Determine which categories are most relevant (IMPROVED: Better event matching)
    let relevantCategories = giftCategories.personal; // default
    const occasionLower = occasion.toLowerCase();
    const relationLower = (relation || '').toLowerCase();

    // Priority 1: Match by specific occasion
    if (occasionLower.includes('valentine')) {
      relevantCategories = giftCategories.romantic;
    } else if (occasionLower.includes('birthday')) {
      relevantCategories = giftCategories.birthday;
    } else if (occasionLower.includes('anniversary')) {
      relevantCategories = giftCategories.anniversary;
    } else if (occasionLower.includes('wedding') || occasionLower.includes('marriage')) {
      relevantCategories = giftCategories.wedding;
    } else if (occasionLower.includes('raksha') || occasionLower.includes('rakhi')) {
      relevantCategories = giftCategories.rakhi;
    } else if (occasionLower.includes('diwali') || occasionLower.includes('holi') || occasionLower.includes('festival')) {
      relevantCategories = giftCategories.festive;
    }
    // Priority 2: Match by relation if occasion is generic
    else if (relationLower.includes('girlfriend') || relationLower.includes('boyfriend') || relationLower.includes('wife') || relationLower.includes('husband')) {
      relevantCategories = giftCategories.romantic;
    } else if (giftType === 'Corporate' || relationLower.includes('colleague') || relationLower.includes('boss') || relationLower.includes('client')) {
      relevantCategories = giftCategories.professional;
    } else if (relationLower.includes('mother') || relationLower.includes('father') || relationLower.includes('sister') || relationLower.includes('brother')) {
      relevantCategories = giftCategories.family;
    }

    // Score each product
    const scored = candidates.map(product => {
      let score = 100;
      const titleLower = product.title.toLowerCase();
      const descLower = product.description.toLowerCase();
      const categoryLower = (product.customLabel1 || product.category || '').toLowerCase();
      const occasionLower = occasion.toLowerCase();

      // 1. Price match (40 points) - closer to budget = higher score
      // INCREASED from 25 to 40 points so budget matters more
      const priceDiff = Math.abs(product.price - budget);
      const priceScore = Math.max(0, 40 - (priceDiff / budget * 40));
      score += priceScore;

      // 2. Occasion match (REDUCED from 15-18 to 8-12 to prevent keyword dominance)
      if (titleLower.includes(occasionLower) || descLower.includes(occasionLower)) {
        score += 12; // Direct occasion match in title/description
      }
      // Valentine-specific (10 points)
      else if (occasion === 'Valentine' || occasionLower.includes('valentine')) {
        if (titleLower.includes('valentine') || titleLower.includes('love') || titleLower.includes('heart') ||
            titleLower.includes('couple') || titleLower.includes('romantic') || titleLower.includes('propose') ||
            descLower.includes('valentine') || descLower.includes('love') || descLower.includes('romantic')) {
          score += 10;
        }
      }
      // Birthday (10 points)
      else if (occasionLower.includes('birthday')) {
        if (titleLower.includes('birthday') || titleLower.includes('celebration') || titleLower.includes('party') ||
            titleLower.includes('bday') || descLower.includes('birthday') || descLower.includes('celebration')) {
          score += 10;
        }
      }
      // Anniversary (10 points)
      else if (occasionLower.includes('anniversary')) {
        if (titleLower.includes('anniversary') || titleLower.includes('couple') || titleLower.includes('years together') ||
            titleLower.includes('memories') || descLower.includes('anniversary') || descLower.includes('couple')) {
          score += 10;
        }
      }
      // Raksha Bandhan (10 points)
      else if (occasionLower.includes('raksha') || occasionLower.includes('rakhi')) {
        if (titleLower.includes('rakhi') || titleLower.includes('brother') || titleLower.includes('sister') ||
            titleLower.includes('raksha') || descLower.includes('rakhi') || descLower.includes('brother')) {
          score += 10;
        }
      }
      // Wedding (10 points)
      else if (occasionLower.includes('wedding') || occasionLower.includes('marriage')) {
        if (titleLower.includes('wedding') || titleLower.includes('marriage') || titleLower.includes('couple') ||
            titleLower.includes('newlywed') || descLower.includes('wedding') || descLower.includes('marriage')) {
          score += 10;
        }
      }
      // Diwali & Festivals (10 points)
      else if (occasionLower.includes('diwali') || occasionLower.includes('holi') || occasionLower.includes('festival')) {
        if (titleLower.includes('diwali') || titleLower.includes('festival') || titleLower.includes('holi') ||
            titleLower.includes('celebration') || descLower.includes('diwali') || descLower.includes('festival')) {
          score += 10;
        }
      }

      // 3. Category relevance (12 points) - Check if product category matches gift type
      // REDUCED from 15 to 12 points
      let categoryMatched = false;
      for (const relevantCat of relevantCategories) {
        if (categoryLower.includes(relevantCat) || titleLower.includes(relevantCat)) {
          score += 12;
          categoryMatched = true;
          break;
        }
      }

      // 3b. RELATION-BASED PRODUCT SUITABILITY (INCREASED from 20 to 35 points)
      // Products that are especially appropriate for specific relationships
      // This is now the DOMINANT factor to ensure relationship-appropriate gifts
      const relationSuitability = {
        // Male recipients - practical/sporty items (NO albums/cushions)
        'brother': ['bottle', 'sipper', 'diary', 'notebook', 'mug', 't-shirt', 'tshirt', 'cap', 'bag', 'wallet'],
        'father': ['diary', 'notebook', 'mug', 'frame', 'calendar', 'pen', 'wallet', 'bottle'],
        'boyfriend': ['mug', 'frame', 'calendar', 'bottle', 'couple', 'wallet', 'diary'],
        'husband': ['mug', 'frame', 'calendar', 'couple', 'wallet', 'diary', 'bottle'],
        'friend_male': ['bottle', 'sipper', 'mug', 'diary', 'notebook', 't-shirt', 'cap'],

        // Female recipients - aesthetic/memorable items
        'sister': ['mug', 'cushion', 'frame', 'calendar', 'diary', 'album', 'hamper', 'photo'],
        'mother': ['frame', 'album', 'cushion', 'calendar', 'mug', 'hamper', 'photo'],
        'girlfriend': ['cushion', 'frame', 'album', 'mug', 'calendar', 'couple', 'hamper', 'photo'],
        'wife': ['cushion', 'frame', 'album', 'calendar', 'couple', 'hamper', 'photo'],
        'friend_female': ['mug', 'diary', 'cushion', 'frame', 'calendar', 'photo'],

        // Professional/Neutral
        'colleague': ['diary', 'notebook', 'pen', 'mug', 'bottle', 'calendar'],
        'boss': ['diary', 'notebook', 'pen', 'trophy', 'award', 'plaque'],
        'friend': ['mug', 'diary', 'bottle', 'cushion', 'frame', 'calendar']
      };

      // Items that are gender-specific and should be penalized for wrong gender
      const maleUnsuitable = ['album', 'photobook', 'cushion', 'pillow', 'hamper'];
      const femaleUnsuitable = ['wallet', 'cap', 't-shirt', 'tshirt'];

      const relationKey = relationLower.replace(/\s+/g, '_');
      const suitableProducts = relationSuitability[relationKey] || relationSuitability['friend'] || [];

      // Check if this is a male or female recipient
      const maleRelations = ['brother', 'father', 'boyfriend', 'husband', 'friend_male'];
      const isMaleRecipient = maleRelations.includes(relationKey);

      let relationScore = 0;
      let relationMatched = false;
      let matchedItem = null;
      for (const suitableItem of suitableProducts) {
        if (titleLower.includes(suitableItem) || categoryLower.includes(suitableItem)) {
          relationScore = 35; // INCREASED: Strong match for relationship-appropriate product
          relationMatched = true;
          matchedItem = suitableItem;
          break;
        }
      }
      score += relationScore;

      // Debug: Log relation scoring for top products
      if (score > 180) {
        console.log(`[Scoring] ${product.title.substring(0, 30)}... | Relation: ${relationKey} | Match: ${matchedItem || 'NONE'} | RelScore: ${relationScore} | Male: ${isMaleRecipient}`);
      }

      // Apply penalty for unsuitable products based on recipient gender
      if (!relationMatched) {
        if (isMaleRecipient) {
          for (const unsuitable of maleUnsuitable) {
            if (titleLower.includes(unsuitable) || categoryLower.includes(unsuitable)) {
              score -= 25; // Penalty for giving albums/cushions to male recipients
              break;
            }
          }
        } else {
          for (const unsuitable of femaleUnsuitable) {
            if (titleLower.includes(unsuitable) || categoryLower.includes(unsuitable)) {
              score -= 15; // Smaller penalty for female recipients
              break;
            }
          }
        }
      }

      // 4. Keyword match (15 points total)
      keywords.forEach(keyword => {
        const kw = keyword.toLowerCase();
        if (titleLower.includes(kw) || descLower.includes(kw) || categoryLower.includes(kw)) {
          score += 5;
        }
      });

      // 5. B2C preference for personal gifts (10 points)
      if (giftType === 'Personal' && product.customLabel0 === 'B2C') {
        score += 10;
      }

      // 6. GIFT IMPACT SCORE (NEW - up to 20 points)
      // High-impact gifts get bonus, low-effort keepsakes get penalty
      // This prevents puzzles/magnets from dominating recommendations
      const giftImpactScores = {
        // HIGH IMPACT - Premium, memorable gifts (+15 to +20)
        'hamper': 20, 'gift box': 20, 'gift set': 20, 'combo': 18,
        'canvas': 18, 'wall art': 18,
        'album': 16, 'photobook': 16,
        'led frame': 15, 'led photo': 15,
        'cushion': 14, 'pillow': 14,
        'diary set': 14, 'gift set': 14,

        // MEDIUM IMPACT - Good practical gifts (+8 to +12)
        'bottle': 12, 'sipper': 12, 'tumbler': 12,
        'calendar': 10,
        'diary': 10, 'notebook': 10, 'planner': 10,
        't-shirt': 10, 'tshirt': 10, 'apparel': 10,
        'mug': 8,
        'bag': 8, 'tote': 8,

        // LOW IMPACT - Small keepsakes (0 to +5, some get penalty)
        'frame': 5, // Regular frames are common
        'coaster': 3,
        'keychain': 2,
        'card': 2,
        'magnet': -5, // PENALTY - too common, not a thoughtful main gift
        'fridge magnet': -8,
        'puzzle': -5, // PENALTY - novelty item, not premium gift
        'jigsaw': -5
      };

      // Apply gift impact score
      let giftImpact = 0;
      for (const [productType, impact] of Object.entries(giftImpactScores)) {
        if (titleLower.includes(productType)) {
          giftImpact = impact;
          break;
        }
      }
      score += giftImpact;

      // 6b. Personalization bonus (small - only 3 points)
      // Don't let "personalized" keyword dominate
      if (titleLower.includes('personalized') || titleLower.includes('custom')) {
        score += 3;
      }

      // 7. Popularity & fast delivery (5 points each)
      if (product.customLabel4 && product.customLabel4.includes('Top')) {
        score += 5;
      }
      if (product.customLabel3 && product.customLabel3.includes('Express')) {
        score += 5;
      }

      // 8. Diversity penalty - reduce score slightly for duplicate categories in top results
      // This will be applied later during selection

      return { product, score, categoryLower };
    });

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    console.log(`[Recommender] Top 5 scores: ${scored.slice(0, 5).map(s => `${s.product.title.substring(0, 30)}...(${s.score.toFixed(1)})`).join(', ')}`);

    return scored;
  }

  /**
   * Select diverse products - IMPROVED ALGORITHM
   * Step 1: Group products by category
   * Step 2: Pick the BEST product from EACH category
   * Step 3: Sort these category-winners by score
   * Step 4: Return top N from the diverse shortlist
   *
   * This ensures variety by first creating a diverse pool, then selecting best
   */
  selectDiverseProducts(scoredProducts, count) {
    if (scoredProducts.length <= count) {
      return scoredProducts;
    }

    // Step 1: Group products by their main category
    const categoryGroups = new Map();

    for (const scored of scoredProducts) {
      const category = this.getMainCategoryKeyword(scored.categoryLower);
      // Also check title for category if categoryLower is generic
      const titleCategory = this.getMainCategoryKeyword(scored.product.title.toLowerCase());
      const finalCategory = category !== 'general' ? category : titleCategory;

      if (!categoryGroups.has(finalCategory)) {
        categoryGroups.set(finalCategory, []);
      }
      categoryGroups.get(finalCategory).push(scored);
    }

    console.log(`[Recommender] Found ${categoryGroups.size} unique categories: ${Array.from(categoryGroups.keys()).join(', ')}`);

    // Step 2: Pick the BEST product from EACH category (already sorted by score)
    const categoryWinners = [];
    for (const [category, products] of categoryGroups) {
      // Products are already sorted by score, so first one is the best
      categoryWinners.push({
        ...products[0],
        category: category
      });
    }

    // Step 3: Sort category winners by score (highest first)
    categoryWinners.sort((a, b) => b.score - a.score);

    // Step 4: Select top N from diverse shortlist
    const selected = categoryWinners.slice(0, count);

    // If we don't have enough categories, fill with next best products
    if (selected.length < count) {
      const selectedProducts = new Set(selected.map(s => s.product.id));

      for (const scored of scoredProducts) {
        if (selected.length >= count) break;
        if (!selectedProducts.has(scored.product.id)) {
          selected.push(scored);
          selectedProducts.add(scored.product.id);
        }
      }
    }

    console.log(`[Recommender] Selected diverse products from categories: ${selected.map(s => s.category || 'unknown').join(', ')}`);
    return selected;
  }

  /**
   * Extract main category keyword for diversity check
   * IMPROVED: More comprehensive category detection
   */
  getMainCategoryKeyword(textLower) {
    if (!textLower) return 'general';

    // Priority order - check specific product types first
    const categoryMap = [
      // Photo products
      ['led frame', 'led-frame'], // LED frames are premium, separate category
      ['frame', 'frame'],
      ['album', 'album'],
      ['photobook', 'album'],
      ['calendar', 'calendar'],
      ['canvas', 'canvas'],
      ['poster', 'poster'],
      ['puzzle', 'puzzle'], // Puzzles are separate from magnets
      ['jigsaw', 'puzzle'],
      ['magnet', 'magnet'],

      // Drinkware
      ['mug', 'mug'],
      ['bottle', 'bottle'],
      ['sipper', 'bottle'],
      ['tumbler', 'bottle'],

      // Soft goods
      ['cushion', 'cushion'],
      ['pillow', 'cushion'],

      // Stationery
      ['diary', 'diary'],
      ['notebook', 'diary'],
      ['planner', 'diary'],

      // Apparel
      ['t-shirt', 'apparel'],
      ['tshirt', 'apparel'],
      ['cap', 'apparel'],
      ['apron', 'apparel'],

      // Gift sets
      ['hamper', 'hamper'],
      ['gift box', 'hamper'],
      ['combo', 'hamper'],
      ['set', 'hamper'],

      // Awards
      ['trophy', 'trophy'],
      ['award', 'trophy'],
      ['plaque', 'trophy'],

      // Cards & invites
      ['card', 'card'],
      ['invite', 'card'],
      ['invitation', 'card'],

      // Other
      ['coaster', 'coaster'],
      ['mousepad', 'mousepad'],
      ['keychain', 'keychain'],
      ['bag', 'bag']
    ];

    for (const [keyword, category] of categoryMap) {
      if (textLower.includes(keyword)) {
        return category;
      }
    }

    // Fallback: use first meaningful word
    const words = textLower.split(/\s+/).filter(w => w.length > 3);
    return words[0] || 'general';
  }

  /**
   * Generate reasoning for why the top product is recommended (SHORT VERSION)
   */
  async generateReasoning(parsedInput, topProduct, allOptions) {
    const { occasion, relation, budget } = parsedInput;
    const product = topProduct.product;

    const prompt = `You are a gift expert. Write ONE SHORT sentence (15-20 words max) explaining why this is the BEST gift.

Gift: ${product.title} (₹${product.price})
Occasion: ${occasion}
Recipient: ${relation}
Budget: ₹${budget}

Write ONE compelling reason why this product is perfect. Be concise, warm, and specific.
DO NOT use phrases like "We recommend this because". Just state the reason directly.

Example: "Perfect romantic gesture with personalized touch that fits your budget beautifully."`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a gifting expert. Write SHORT, punchy recommendations (15-20 words).' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 50
      });

      return response.choices[0].message.content.trim();

    } catch (error) {
      console.error('[Recommender] Reasoning error:', error);
      return `Perfect ${occasion} gift for your ${relation} within ₹${budget} budget.`;
    }
  }

  /**
   * Main recommendation method
   * Input: Single string from Botspace
   * Output: Multiple recommendations with one highlighted as BEST
   */
  async recommend(customerInput, options = {}) {
    try {
      console.log('[Recommender] Processing:', customerInput);

      // Step 1: Parse the input
      const parsedInput = await this.parseInput(customerInput);
      console.log('[Recommender] Parsed:', parsedInput);

      // Step 2: Filter and score products
      const scoredProducts = this.filterAndScoreProducts(parsedInput);

      if (scoredProducts.length === 0) {
        return {
          success: false,
          message: `Sorry, we couldn't find products matching your requirements (${parsedInput.occasion}, ₹${parsedInput.budget} budget). Please try a different budget range.`,
          parsedInput
        };
      }

      // Step 3: Get top 5-6 products with DIVERSITY (IMPROVED: More options)
      const topN = options.count || 6;
      const topProducts = this.selectDiverseProducts(scoredProducts, topN);

      // Step 4: Generate reasoning for the best product
      const reasoning = await this.generateReasoning(parsedInput, topProducts[0], topProducts);

      // Step 5: Format response
      const recommendations = topProducts.map((scored, index) => {
        const product = scored.product;
        const isRecommended = index === 0;

        return {
          id: product.id,
          title: product.title,
          price: product.price,
          priceDisplay: product.priceDisplay,
          category: product.customLabel1 || product.category,
          description: product.description.substring(0, 200) + '...',
          link: product.link,
          imageLink: product.imageLink,
          isRecommended,
          reasoning: isRecommended ? reasoning : null,
          matchScore: Math.round(scored.score),
          deliveryInfo: product.customLabel3 || '',
          shippingLabel: product.shippingLabel || ''
        };
      });

      // Step 6: Build WhatsApp message
      const message = this.buildWhatsAppMessage(parsedInput, recommendations);

      return {
        success: true,
        parsedInput,
        recommendations,
        recommendedProduct: recommendations[0],
        message,
        totalMatches: scoredProducts.length
      };

    } catch (error) {
      console.error('[Recommender] Error:', error);
      throw error;
    }
  }

  /**
   * Build WhatsApp-formatted message (SHORT & CLEAN)
   */
  buildWhatsAppMessage(parsedInput, recommendations) {
    const topRec = recommendations[0];

    // Short intro
    let msg = `🎁 *${parsedInput.occasion} Gift for ${parsedInput.relation}*\n`;
    msg += `Budget: ₹${parsedInput.budget}\n\n`;

    // TOP RECOMMENDATION (highlighted)
    msg += `⭐ *OUR TOP PICK*\n`;
    msg += `*${topRec.title}*\n`;
    msg += `₹${topRec.price}`;
    if (topRec.deliveryInfo) {
      msg += ` • ${topRec.deliveryInfo}`;
    }
    msg += `\n${topRec.link}\n\n`;

    // Brief reasoning (1 line only)
    if (topRec.reasoning) {
      const shortReason = topRec.reasoning.split('.')[0] + '.';
      msg += `💡 ${shortReason}\n\n`;
    }

    // OTHER OPTIONS (compact list)
    if (recommendations.length > 1) {
      msg += `*More Options:*\n`;
      recommendations.slice(1).forEach((rec, index) => {
        msg += `${index + 2}. ${rec.title} - ₹${rec.price}\n`;
        msg += `   ${rec.link}\n`;
      });
    }

    msg += `\n📞 Need help? Chat with us!`;

    return msg;
  }
}

module.exports = ProductRecommender;
