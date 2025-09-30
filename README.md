# Printo Customer Support Solutions

This workspace contains two distinct customer support AI solutions for Printo.in:

## 📁 Project Structure

```
printo-cs-assistant/
├── printo-cs-assistant-app/   # Original OpenAI-based CS Assistant
│   ├── server.js             # Express server with OpenAI integration
│   ├── index.html            # Main chat interface
│   ├── package.json          # Dependencies and scripts
│   ├── .env                  # Environment variables
│   └── README.md            # Setup instructions
├── printobot-gemini/         # Gemini AI Customer Support Bot
│   ├── server.js             # Express server with Gemini integration
│   ├── knowledge/            # Product knowledge base
│   ├── utils/               # Utilities and prompt builders
│   ├── package.json         # Dependencies and scripts
│   ├── .env                 # Environment variables
│   └── README.md           # Setup instructions
├── .env                     # Shared environment variables
├── .gitignore              # Git ignore rules
└── README.md              # This file
```

## 🚀 Projects Overview

### 1. Printo CS Assistant (Original OpenAI App)
- **Technology**: OpenAI GPT-4 integration
- **Port**: 3000
- **Features**: Simple customer support interface, query history, copy-to-clipboard
- **Use Case**: Quick customer support responses for support team

### 2. PrintoBot Gemini
- **Technology**: Google Gemini 2.0 Flash
- **Port**: 3002
- **Features**: Session management, product recommendations, advanced conversation
- **Use Case**: Interactive customer support with product-specific guidance

## 🛠️ Quick Start

### Option 1: Run Both Projects
```bash
# Terminal 1 - Original CS Assistant (OpenAI)
cd printo-cs-assistant-app
npm install
npm start

# Terminal 2 - PrintoBot (Gemini)
cd printobot-gemini
npm install
npm start
```

### Option 2: Run Individual Projects
```bash
# For Original CS Assistant only
cd printo-cs-assistant-app && npm install && npm start

# For PrintoBot only
cd printobot-gemini && npm install && npm start
```

## 🔧 Environment Setup

Each project has its own `.env` file with specific configuration:

- **printo-cs-assistant-app/.env**: OpenAI API key, port 3000
- **printobot-gemini/.env**: Gemini API key, port 3002

## 📖 Documentation

For detailed setup, configuration, and usage instructions, refer to the README.md file in each project folder:

- [Printo CS Assistant README](./printo-cs-assistant-app/README.md)
- [PrintoBot Gemini README](./printobot-gemini/README.md)

## 🌐 Access URLs

- **Original CS Assistant**: http://localhost:3000
- **PrintoBot**: http://localhost:3002

## 📞 Support

For issues or questions:
- **Phone**: 9513734374
- **Email**: support@printo.in
- **Website**: https://printo.in