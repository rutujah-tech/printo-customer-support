# Printo CS Assistant - AWS Lightsail Deployment Guide

## Overview
This is a production-ready WhatsApp chatbot for Printo customer support, featuring:
- Product inquiry assistance
- **Order status tracking** (NEW - via PIA API integration)
- Google Sheets logging
- BotSpace webhook integration
- UTM tracking for analytics

---

## Essential Files for Deployment

### Core Application
```
server.js                      # Main Express server
promptBuilder.js               # Dynamic system prompt builder
package.json                   # Dependencies
.env.example                   # Environment template
```

### Order Status Integration (NEW)
```
phone-extractor.js             # Extract phone from customer messages
pia-api-client.js              # PIA API integration
order-status-formatter.js      # WhatsApp message formatting
```

### Services
```
google-sheets-logger.js        # Conversation logging
botspace-service.js            # BotSpace webhook handler
conversation-aggregator.js     # Aggregate conversations
utm-builder.js                 # UTM parameter generation
utm-tracker.js                 # Analytics tracking
product_filter.js              # Smart product filtering
```

### Data
```
scraped_products.json          # Product catalog (205KB)
system_prompt/                 # System prompt data
  ├── products.json
  └── system_prompt.txt
```

### Frontend
```
public/
  ├── index.html               # Web chat interface
  ├── script.js                # Frontend JavaScript
  └── styles.css               # Styles
```

---

## Environment Variables Required

Create `.env` file with these variables:

```bash
# ============================================
# OPENAI API
# ============================================
OPENAI_API_KEY=your_openai_api_key_here

# ============================================
# GOOGLE SHEETS LOGGING
# ============================================
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ============================================
# BOTSPACE INTEGRATION (Optional)
# ============================================
BOTSPACE_CHANNEL_ID=your_botspace_channel_id
BOTSPACE_API_KEY=your_botspace_api_key

# ============================================
# PIA API (Order Status Integration)
# ============================================
PIA_API_URL=https://beta-pia.printo.in/api/v1/legacy/chatbot/order-status/
PIA_BEARER_TOKEN=your_pia_bearer_token
PIA_AUTH_URL=https://beta-pia.printo.in/api/v1/auth/
PIA_USERNAME=chatbot-ai@printo.in
PIA_PASSWORD=your_pia_password

# ============================================
# SERVER
# ============================================
PORT=3004
NODE_ENV=production
```

---

## AWS Lightsail Deployment Steps

### 1. Prepare Repository

```bash
# Clone or pull latest code
git clone your-repo-url
cd printo-cs-assistant-app

# Install dependencies
npm install

# Test locally
npm start
```

### 2. Create Lightsail Instance

1. Go to AWS Lightsail Console
2. Create Instance → Node.js platform
3. Choose instance plan (minimum: $3.50/month for 512MB RAM)
4. Create instance

### 3. Deploy to Lightsail

**Option A: Using Git (Recommended)**

```bash
# SSH into Lightsail instance
ssh -i your-key.pem bitnami@your-instance-ip

# Navigate to app directory
cd /opt/bitnami/projects

# Clone repository
git clone your-repo-url printo-cs-assistant
cd printo-cs-assistant/printo-cs-assistant-app

# Install dependencies
npm install --production

# Create .env file
nano .env
# (Paste environment variables, save with Ctrl+X, Y, Enter)

# Start with PM2
pm2 start server.js --name printo-assistant
pm2 save
pm2 startup
```

**Option B: Using SFTP Upload**

```bash
# Upload files via SFTP
sftp -i your-key.pem bitnami@your-instance-ip

# Upload essential files only:
put server.js
put promptBuilder.js
put package.json
put phone-extractor.js
put pia-api-client.js
put order-status-formatter.js
put google-sheets-logger.js
put botspace-service.js
put conversation-aggregator.js
put utm-builder.js
put utm-tracker.js
put product_filter.js
put scraped_products.json
put .env
# Upload public/ and system_prompt/ folders
```

### 4. Configure Nginx (if needed)

```bash
# Edit Nginx config
sudo nano /opt/bitnami/nginx/conf/server_blocks/nodejs-server-block.conf

# Add:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Restart Nginx
sudo /opt/bitnami/ctlscript.sh restart nginx
```

### 5. Set Up Domain & SSL

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

---

## Monitoring & Logs

```bash
# View application logs
pm2 logs printo-assistant

# Monitor performance
pm2 monit

# Restart application
pm2 restart printo-assistant

# View Nginx logs
sudo tail -f /opt/bitnami/nginx/logs/access.log
sudo tail -f /opt/bitnami/nginx/logs/error.log
```

---

## Production Checklist

- [ ] All environment variables configured in `.env`
- [ ] PIA API token valid (expires Feb 6, 2026)
- [ ] Google Sheets API credentials configured
- [ ] BotSpace webhook configured (if used)
- [ ] SSL certificate installed
- [ ] PM2 configured to restart on reboot
- [ ] Firewall configured (port 80, 443 open)
- [ ] Domain DNS pointing to Lightsail IP
- [ ] Test order status feature with real phone numbers
- [ ] Monitor Google Sheets logging
- [ ] Set up CloudWatch or monitoring alerts

---

## Testing Order Status Integration

Test the order status feature:

1. **Via Web Interface:**
   - Visit: `https://your-domain.com`
   - Type: `this is my number 9582226884`
   - Expected: Shows order summary and first 3 orders

2. **Via API:**
   ```bash
   curl -X POST https://your-domain.com/api/chat \
     -H "Content-Type: application/json" \
     -d '{"question": "9582226884", "userId": "test", "sessionId": "test"}'
   ```

3. **Check Logs:**
   ```bash
   pm2 logs printo-assistant | grep "Order status"
   ```

---

## Troubleshooting

**Issue: Port 3004 already in use**
```bash
pm2 stop all
pm2 delete all
pm2 start server.js --name printo-assistant
```

**Issue: Environment variables not loading**
```bash
# Check .env file exists
ls -la .env

# Restart with explicit env file
pm2 restart printo-assistant --update-env
```

**Issue: PIA API timeout**
- Check PIA_BEARER_TOKEN is valid
- Verify network connectivity to beta-pia.printo.in
- Check PIA API logs

**Issue: Google Sheets not logging**
- Verify GOOGLE_PRIVATE_KEY has newlines `\n`
- Check service account has edit access to sheet
- Test sheets connection:
  ```bash
  node -e "require('./google-sheets-logger.js')"
  ```

---

## Automated Deployment with GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Lightsail

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Deploy to Lightsail
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.LIGHTSAIL_HOST }}
          username: bitnami
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/bitnami/projects/printo-cs-assistant/printo-cs-assistant-app
            git pull origin main
            npm install --production
            pm2 restart printo-assistant
```

---

## Security Best Practices

1. **Never commit** `.env` file to Git
2. **Rotate PIA token** before expiry (Feb 6, 2026)
3. **Use Lightsail firewall** - allow only 80, 443, 22
4. **Enable CloudWatch** logs for monitoring
5. **Set up automated backups** of Lightsail instance
6. **Use environment-specific** .env files (dev/staging/prod)
7. **Monitor API usage** to avoid rate limits

---

## Support & Maintenance

**Updating Product Catalog:**
- Update `scraped_products.json`
- Restart: `pm2 restart printo-assistant`

**Updating System Prompt:**
- Edit `system_prompt/system_prompt.txt`
- Restart: `pm2 restart printo-assistant`

**Refreshing PIA Token:**
```bash
# Update .env with new token
nano .env

# Restart
pm2 restart printo-assistant
```

---

## Architecture

```
Client (WhatsApp/Web)
        ↓
    BotSpace (optional)
        ↓
   Express Server (server.js)
        ↓
    ┌───┴───────────────────┐
    ↓                       ↓
Phone detected?        No phone
    ↓                       ↓
PIA API              OpenAI GPT-4
(Order Status)       (Product Inquiry)
    ↓                       ↓
Format orders        Build prompt
    ↓                       ↓
    └───┬───────────────────┘
        ↓
  Google Sheets Log
        ↓
   Return to User
```

---

## Resources

- **GitHub Repository:** [your-repo-url]
- **PIA API Docs:** Contact Printo Tech Team
- **BotSpace Docs:** https://botspace.ai/docs
- **Google Sheets API:** https://developers.google.com/sheets

---

Last Updated: 2025-01-02
Version: 2.0 (with Order Status Integration)
