# Printo CS Assistant - Deployment Package

## 🚀 Quick Deploy Guide

### What's Included

This deployment package includes all the latest updates:

✅ **V4 Features:**
- Product synonym & intent mapping (magazine→booklets, print pics→photo prints)
- Same-day delivery intelligence (time-aware, before 3 PM check)
- FAQ-based intelligent answers
- Order completion with pricing calculation (3-tier: exact/range/skip)
- Enhanced time-aware phone policy (10 AM-7 PM Mon-Sat)

✅ **UTM Tracking:**
- Automatic UTM parameters on all product links
- Track clicks, conversions, revenue, and customer journey
- Google Analytics ready

✅ **Delivery Date Guidance:**
- Guides customers to check delivery dates themselves when asked repeatedly
- Step-by-step instructions for pincode entry on website

---

## 📦 Files Included

```
deployment-package/
├── server.js                    # Main application server
├── promptBuilder.js             # Dynamic prompt builder with V4 features
├── utm-tracker.js               # UTM tracking module
├── google-sheets-logger.js      # Conversation logging
├── botspace-service.js          # BotSpace integration
├── package.json                 # Dependencies
├── scraped_products.json        # Product catalog (577 products)
├── system_prompt/
│   ├── system_prompt.txt       # AI behavior rules (with all V4 features)
│   └── products.json           # Product context
├── .env.example                # Environment variables template
└── README.md                   # This file
```

---

## ⚙️ Deployment Steps

### 1. **Upload Files**

Upload all files to your server, maintaining the folder structure.

### 2. **Install Dependencies**

```bash
npm install
```

### 3. **Configure Environment Variables**

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

**Required Variables:**

```env
# OpenAI API Key
OPENAI_API_KEY=sk-proj-your-key-here

# Google Sheets (for conversation logging)
GOOGLE_SHEET_ID=your-sheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-email@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# BotSpace Integration (for WhatsApp)
BOTSPACE_CHANNEL_ID=your-channel-id
BOTSPACE_API_KEY=your-api-key

# Server Configuration
PORT=3004
```

### 4. **Start the Server**

```bash
npm start
```

Or for production with PM2:

```bash
npm install -g pm2
pm2 start server.js --name "printo-assistant"
pm2 save
pm2 startup
```

---

## 🔗 BotSpace Integration

### Webhook URL

Set this in your BotSpace workflow:

```
https://your-domain.com/webhook
```

### Expected Request Format

BotSpace should send:

```json
{
  "phone": "919876543210",
  "message": "I need business cards"
}
```

---

## 📊 Google Analytics Setup (for UTM Tracking)

UTM tracking is already implemented. To view data:

1. Go to Google Analytics → **Acquisition** → **All Traffic** → **Source/Medium**
2. Look for: `whatsapp_bot / chatbot`
3. Create custom reports to track:
   - Total clicks from bot
   - Which products get most interest
   - Conversion rate (clicks → orders)
   - Revenue attribution

📄 See `UTM-TRACKING-GUIDE.md` (in parent folder) for complete setup instructions.

---

## 🧪 Testing

### Local Testing

```bash
# Start server
npm start

# Test endpoint
curl -X POST http://localhost:3004/chat \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "919876543210",
    "message": "I need business cards"
  }'
```

### Production Health Check

```bash
curl https://your-domain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-26T10:30:00.000Z"
}
```

---

## 📝 Key Features to Test

1. **Product Synonym Mapping:**
   - Test: "I need pamphlets" → Should map to Brochures category

2. **Same-Day Delivery:**
   - Test: "100 business cards, need today" → Should check if before 3 PM and guide accordingly

3. **FAQ Intelligence:**
   - Test: "What payment methods do you accept?" → Should answer from FAQ knowledge base

4. **Order Completion:**
   - After providing all details, bot should calculate pricing (if available) and offer order/call options

5. **Delivery Date Self-Check:**
   - Test: "Can I get it tomorrow?" (repeatedly) → Should guide customer to check on website

6. **UTM Tracking:**
   - Check that all product links include UTM parameters

---

## 🔧 Troubleshooting

### Server won't start

**Error:** `EADDRINUSE: address already in use`
**Fix:**
```bash
# Find process using port 3004
netstat -ano | findstr :3004
# Kill the process
taskkill /F /PID <process-id>
```

### OpenAI API errors

**Error:** `401 Unauthorized`
**Fix:** Check that `OPENAI_API_KEY` in `.env` is correct

### Google Sheets not logging

**Error:** `Failed to append to Google Sheet`
**Fix:**
1. Check `GOOGLE_PRIVATE_KEY` format (must have `\n` for newlines)
2. Verify service account has edit access to the sheet
3. Check `GOOGLE_SHEET_ID` is correct

### BotSpace webhook not working

**Error:** `BotSpace credentials not configured`
**Fix:** Set `BOTSPACE_CHANNEL_ID` and `BOTSPACE_API_KEY` in `.env`

---

## 📈 Monitoring

### View Logs

```bash
# If using PM2
pm2 logs printo-assistant

# If using npm start directly
# Logs will appear in console
```

### Key Metrics to Monitor

1. **Conversation Logs:** Check Google Sheet for all interactions
2. **UTM Analytics:** Monitor Google Analytics for click-through and conversion rates
3. **Server Health:** Monitor `/health` endpoint
4. **API Usage:** Track OpenAI API usage in OpenAI dashboard

---

## 🔄 Updating the Prompt

To modify bot behavior, edit:

```
system_prompt/system_prompt.txt
```

After editing, restart the server:

```bash
# If using PM2
pm2 restart printo-assistant

# If using npm start
# Stop (Ctrl+C) and run: npm start
```

---

## 📞 Support

**Technical Issues:** Contact your development team
**Feature Requests:** Document in project requirements

---

## 🔒 Security Notes

1. **Never commit `.env` file** - Contains sensitive credentials
2. **Use HTTPS** in production - Protect customer data
3. **Rotate API keys** regularly - For security
4. **Restrict Google Sheet access** - Only to service account

---

## 📊 Version Information

**Version:** V4 (with UTM tracking + Delivery date guidance)
**Last Updated:** November 26, 2025
**Node Version Required:** 16.x or higher

---

## ✅ Deployment Checklist

Before going live:

- [ ] All environment variables configured in `.env`
- [ ] Google Sheet accessible and logging working
- [ ] BotSpace webhook URL configured
- [ ] Server accessible from internet (if production)
- [ ] HTTPS certificate configured (if production)
- [ ] Test all 6 key features listed above
- [ ] Google Analytics tracking verified
- [ ] PM2 (or equivalent) configured for auto-restart
- [ ] Backup strategy in place for conversation logs
- [ ] Team trained on monitoring and troubleshooting

---

**Status:** ✅ Ready for Deployment

This package includes all the latest improvements and is production-ready!
