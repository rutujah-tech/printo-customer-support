/**
 * Google Sheets Product Loader
 *
 * Fetches product data from Google Sheets and converts it to a clean knowledge base
 * NO old logic, NO hardcoded rules, ONLY Google Sheets data
 */

const { google } = require('googleapis');
const fs = require('fs');

class GoogleSheetsProductLoader {
  constructor(config = {}) {
    this.spreadsheetId = config.spreadsheetId || '18zVnfRrO8w0gX3T59tFo_a19pStHKm8eyOm7IJ9wKYM';
    this.credentialsPath = config.credentialsPath || './google-credentials.json';
    this.sheetName = config.sheetName || 'Sheet1';
    this.cacheFile = config.cacheFile || './products-from-sheets.json';
    this.cacheDuration = config.cacheDuration || 3600000; // 1 hour in ms
  }

  /**
   * Get Google Sheets API client
   */
  async getClient() {
    const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    return google.sheets({ version: 'v4', auth: authClient });
  }

  /**
   * Parse price string to number
   * Examples: "397.95INR" -> 397.95, "1000" -> 1000
   */
  parsePrice(priceString) {
    if (!priceString) return null;

    // Remove "INR" and any other non-numeric characters except decimal point
    const cleanPrice = priceString.toString().replace(/[^\d.]/g, '');
    const price = parseFloat(cleanPrice);

    return isNaN(price) ? null : price;
  }

  /**
   * Extract main category from product_type
   * Example: "Home > Photo Mugs" -> "Photo Mugs"
   */
  extractMainCategory(productType) {
    if (!productType) return 'General';

    const parts = productType.split('>').map(p => p.trim());
    return parts[parts.length - 1] || parts[0] || 'General';
  }

  /**
   * Fetch all products from Google Sheets
   */
  async fetchProducts() {
    console.log('[GoogleSheets] Fetching products from sheet...');

    const sheets = await this.getClient();

    // Fetch all data from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetName}!A:Q`, // All columns A to Q
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      console.log('[GoogleSheets] No data found');
      return [];
    }

    // First row is headers
    const headers = rows[0];
    console.log('[GoogleSheets] Headers:', headers);

    // Convert rows to product objects
    const products = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      // Create product object from row data
      const product = {
        id: row[0] || '',
        title: row[1] || '',
        price: this.parsePrice(row[2]),
        priceDisplay: row[2] || '',
        description: row[3] || '',
        availability: row[4] || '',
        condition: row[5] || '',
        link: row[6] || '',
        imageLink: row[7] || '',
        brand: row[8] || 'Printo',
        productType: row[9] || '',
        category: this.extractMainCategory(row[9]),
        googleProductCategory: row[10] || '',
        customLabel0: row[11] || '', // B2B/B2C
        customLabel1: row[12] || '', // Main category like "Mugs", "Business Cards"
        customLabel2: row[13] || '', // Performance label
        customLabel3: row[14] || '', // Delivery info
        customLabel4: row[15] || '', // Popularity
        shippingLabel: row[16] || '',
      };

      // Only include products with valid price and link
      if (product.price && product.link && product.title) {
        products.push(product);
      }
    }

    console.log(`[GoogleSheets] Loaded ${products.length} products`);
    return products;
  }

  /**
   * Load products (with caching)
   */
  async loadProducts(forceRefresh = false) {
    // Check cache first (unless force refresh)
    if (!forceRefresh && fs.existsSync(this.cacheFile)) {
      const stats = fs.statSync(this.cacheFile);
      const cacheAge = Date.now() - stats.mtimeMs;

      if (cacheAge < this.cacheDuration) {
        console.log('[GoogleSheets] Loading from cache...');
        const cached = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
        console.log(`[GoogleSheets] Loaded ${cached.products.length} products from cache`);
        return cached.products;
      }
    }

    // Fetch fresh data from Google Sheets
    const products = await this.fetchProducts();

    // Save to cache
    const cacheData = {
      lastUpdated: new Date().toISOString(),
      totalProducts: products.length,
      products: products,
    };

    fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData, null, 2));
    console.log('[GoogleSheets] Cache updated');

    return products;
  }

  /**
   * Get product statistics
   */
  getStats(products) {
    const categories = {};
    const priceRanges = { low: 0, mid: 0, high: 0, premium: 0 };

    products.forEach(p => {
      // Count categories
      const cat = p.customLabel1 || p.category;
      categories[cat] = (categories[cat] || 0) + 1;

      // Count price ranges
      if (p.price < 500) priceRanges.low++;
      else if (p.price < 1500) priceRanges.mid++;
      else if (p.price < 5000) priceRanges.high++;
      else priceRanges.premium++;
    });

    return {
      totalProducts: products.length,
      categories: Object.keys(categories).length,
      topCategories: Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      priceRanges,
    };
  }
}

module.exports = GoogleSheetsProductLoader;
