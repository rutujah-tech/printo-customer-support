# Production Files Checklist

## Files to Include in GitHub Repository

### Core Application (10 files)
- [x] server.js
- [x] promptBuilder.js
- [x] package.json
- [x] .env.example
- [x] .gitignore
- [x] README.md
- [x] DEPLOYMENT.md

### Order Status Integration (3 files) - NEW
- [x] phone-extractor.js
- [x] pia-api-client.js
- [x] order-status-formatter.js

### Services (6 files)
- [x] google-sheets-logger.js
- [x] botspace-service.js
- [x] conversation-aggregator.js
- [x] utm-builder.js
- [x] utm-tracker.js
- [x] product_filter.js

### Data (2 files/folders)
- [x] scraped_products.json
- [x] system_prompt/
  - [x] products.json
  - [x] system_prompt.txt

### Frontend (3 files)
- [x] public/index.html
- [x] public/script.js
- [x] public/styles.css

---

## Total: ~25 Essential Files

All other files (test files, documentation, debug files, scrapers, deployment archives, etc.) are excluded via .gitignore.

---

## Excluded Categories

### Will NOT be pushed to GitHub:

1. **Test Files** (~29 files)
   - test-*.js
   - debug-*.js
   - *-test.js

2. **Documentation** (~35 .md files)
   - All guides, summaries, checklists
   - Kept only: README.md, DEPLOYMENT.md

3. **Scrapers** (~15 files)
   - scrape-*.js
   - scraper-*.js

4. **Deployment Archives** (~12 .zip files)
   - All .zip files excluded

5. **Debug Files**
   - HTML debug files
   - Screenshots
   - Log outputs

6. **Build/Temp Folders**
   - node_modules/
   - deployment-temp/
   - aws-deployment/

7. **Environment Files**
   - .env (secrets)
   - .env.botspace

8. **Utility Scripts** (~15 files)
   - analyze-*.js
   - check-*.js
   - aggregate-*.js
   - etc.

---

## Repository Size Comparison

**Before Cleanup:**
- ~200+ files
- Multiple deployment folders
- Lots of documentation and test files
- Messy structure

**After Cleanup:**
- ~25 essential files
- Clean, production-ready structure
- Only deployment-relevant code
- Well-organized

---

## Next Steps

1. Add new files to git:
   ```bash
   git add phone-extractor.js
   git add pia-api-client.js
   git add order-status-formatter.js
   git add botspace-service.js
   git add conversation-aggregator.js
   git add utm-builder.js
   git add utm-tracker.js
   git add product_filter.js
   git add scraped_products.json
   git add .gitignore
   git add DEPLOYMENT.md
   ```

2. Commit changes:
   ```bash
   git commit -m "feat: Add order status integration + cleanup for Lightsail deployment"
   ```

3. Push to GitHub:
   ```bash
   git push origin main
   ```

4. Verify on GitHub that only essential files are present

5. Deploy to AWS Lightsail using the clean repository
