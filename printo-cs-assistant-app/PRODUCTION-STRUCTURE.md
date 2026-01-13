# Production Repository Structure

## Clean GitHub Repository Structure

```
printo-cs-assistant-app/
│
├── 📄 Core Application Files (7)
│   ├── server.js                      ⭐ Main Express server
│   ├── promptBuilder.js               ⭐ System prompt builder
│   ├── package.json                   ⭐ Dependencies
│   ├── .env.example                   📋 Environment template
│   ├── .gitignore                     🚫 Git exclusions
│   ├── README.md                      📖 Project docs
│   └── DEPLOYMENT.md                  📖 Deployment guide
│
├── 🆕 Order Status Integration (3)
│   ├── phone-extractor.js             📞 Extract phone from messages
│   ├── pia-api-client.js              🔌 PIA API integration
│   └── order-status-formatter.js      💬 Format WhatsApp messages
│
├── ⚙️ Services (6)
│   ├── google-sheets-logger.js        📊 Log to Google Sheets
│   ├── botspace-service.js            🤖 BotSpace integration
│   ├── conversation-aggregator.js     📝 Aggregate conversations
│   ├── utm-builder.js                 🔗 UTM parameter builder
│   ├── utm-tracker.js                 📈 Analytics tracking
│   └── product_filter.js              🔍 Smart product filtering
│
├── 📦 Data (2)
│   ├── scraped_products.json          🛍️ Product catalog (205KB)
│   └── system_prompt/                 📂 System prompt folder
│       ├── products.json              🏷️ Product data
│       └── system_prompt.txt          📝 System prompt text
│
└── 🎨 Frontend (3)
    └── public/
        ├── index.html                 🌐 Web interface
        ├── script.js                  ⚡ Frontend JS
        └── styles.css                 🎨 Styles

TOTAL: 25 essential files
```

---

## What's Excluded (Not in GitHub)

```
❌ EXCLUDED (175+ files)
│
├── 🧪 Test Files (29)
│   ├── test-*.js
│   ├── debug-*.js
│   ├── test-*.html
│   └── test-*.txt
│
├── 📚 Documentation (35)
│   ├── AI-*.md
│   ├── AWS-*.md
│   ├── DEPLOYMENT-*.md
│   ├── *-GUIDE.md
│   ├── *-SUMMARY.md
│   └── ... (all except README & DEPLOYMENT)
│
├── 🕷️ Scrapers (15)
│   ├── scraper-*.js
│   ├── scrape-*.js
│   └── enhanced-scraper.js
│
├── 📦 Archives (12)
│   ├── *.zip
│   ├── printo-aws-*.zip
│   └── printo-deployment-*.zip
│
├── 🐛 Debug Files
│   ├── *-debug.html (3 large files)
│   ├── *.png (screenshots)
│   └── debug-*.txt
│
├── 🔧 Utility Scripts (15)
│   ├── analyze-*.js
│   ├── check-*.js
│   ├── aggregate-*.js
│   └── scheduler.js
│
├── 📁 Old Deployment Folders
│   ├── aws-deployment/
│   ├── deployment-temp/
│   └── aws-deployment*/
│
└── 🔐 Secrets
    ├── .env
    ├── .env.botspace
    └── credentials.json
```

---

## Deployment Flow

```
┌─────────────────────────────────────────────────────┐
│  Local Development                                  │
│  (200+ files - all test/debug/docs)                │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ .gitignore filters
                   │ (excludes 175+ files)
                   ↓
┌─────────────────────────────────────────────────────┐
│  GitHub Repository                                  │
│  (25 essential files only)                         │
│  ✅ Clean, production-ready code                   │
└──────────────────┬──────────────────────────────────┘
                   │
                   │ git clone
                   ↓
┌─────────────────────────────────────────────────────┐
│  AWS Lightsail                                      │
│  (25 files + .env + node_modules)                  │
│  🚀 Production deployment                           │
└─────────────────────────────────────────────────────┘
```

---

## File Size Comparison

| Category | Before | After | Savings |
|----------|--------|-------|---------|
| Total Files | 200+ | 25 | 175+ files removed |
| Repository Size | ~10 MB | ~500 KB | 95% reduction |
| Documentation | 35 .md files | 2 .md files | 33 removed |
| Test Files | 29 files | 0 files | 29 removed |
| Archives | 12 .zip files | 0 files | 12 removed |
| Debug Files | 20+ files | 0 files | 20+ removed |

---

## Production Readiness Checklist

### ✅ Repository Cleanup
- [x] .gitignore created and configured
- [x] Test files excluded
- [x] Debug files excluded
- [x] Documentation trimmed (kept README + DEPLOYMENT)
- [x] Scraper scripts excluded
- [x] Deployment archives excluded
- [x] Secrets (.env) excluded

### ✅ Essential Files Included
- [x] Core application (7 files)
- [x] Order status integration (3 files)
- [x] Services (6 files)
- [x] Data (2 items)
- [x] Frontend (3 files)

### ✅ Documentation
- [x] README.md (project overview)
- [x] DEPLOYMENT.md (Lightsail guide)
- [x] .env.example (environment template)
- [x] PRODUCTION-STRUCTURE.md (this file)

### 📋 Pending - Your Actions
- [ ] Run `prepare-github-push.bat`
- [ ] Review staged files
- [ ] Commit changes
- [ ] Push to GitHub
- [ ] Verify on GitHub (only 25 files visible)
- [ ] Deploy to AWS Lightsail
- [ ] Configure .env on Lightsail
- [ ] Test order status integration
- [ ] Monitor logs

---

## Quick Commands

### Prepare & Push
```bash
# 1. Prepare (stages only 25 essential files)
prepare-github-push.bat

# 2. Commit
git commit -m "feat: Add order status integration + cleanup for Lightsail"

# 3. Push
git push origin main
```

### Verify on GitHub
```bash
# Should show ~25 files only
# NO test-*.js
# NO debug-*.html
# NO *.zip
# NO scraper-*.js
```

### Deploy to Lightsail
```bash
# SSH
ssh -i key.pem bitnami@ip

# Clone
git clone repo.git printo-cs-assistant
cd printo-cs-assistant/printo-cs-assistant-app

# Setup
npm install --production
nano .env  # add env vars
pm2 start server.js --name printo-assistant
pm2 save
```

---

## Maintenance

### Update Code
```bash
# On Lightsail
git pull origin main
npm install --production
pm2 restart printo-assistant
```

### Update Product Catalog
```bash
# Upload new scraped_products.json
# Then:
pm2 restart printo-assistant
```

### Update System Prompt
```bash
# Edit system_prompt/system_prompt.txt
# Then:
pm2 restart printo-assistant
```

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Client (WhatsApp/Web)                              │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│  BotSpace (Optional)                                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│  Express Server (server.js)                         │
│  PORT 3004                                          │
└──────┬──────────────────────────────────────────────┘
       │
       ├─ Phone detected? ────────┐
       │                           │
       YES                        NO
       │                           │
       ↓                           ↓
┌──────────────────┐    ┌──────────────────┐
│  PIA API Client  │    │  OpenAI GPT-4    │
│  Order Status    │    │  Product Inquiry │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         ↓                       ↓
┌──────────────────┐    ┌──────────────────┐
│  Format Orders   │    │  Build Prompt    │
│  (3 at a time)   │    │  + UTM Tracking  │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         └───────┬───────────────┘
                 ↓
┌─────────────────────────────────────────────────────┐
│  Google Sheets Logger                               │
│  (Async logging)                                    │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────────┐
│  Response to Client                                 │
└─────────────────────────────────────────────────────┘
```

---

Ready to push? Run `prepare-github-push.bat`!
