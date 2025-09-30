# Printo CS Assistant

A simple AI-powered customer support tool for Printo's support team to get instant ChatGPT responses to customer questions.

## Features

- 🤖 AI-powered responses using OpenAI GPT-4
- 📋 One-click copy to clipboard
- 📚 Query history (last 10 queries)
- 📱 Mobile-responsive design
- ⚡ Fast and lightweight

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure OpenAI API Key
Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-your-api-key-here
PORT=3000
```

### 3. Run the Application
```bash
# Development mode (auto-restart on changes)
npm run dev

# Production mode
npm start
```

### 4. Access the App
Open your browser and go to: `http://localhost:3000`

## How to Use

1. **Paste Question**: Paste the customer's question in the text box
2. **Get Response**: Click "Get AI Response" button
3. **Copy Answer**: Use the copy button to copy the AI response
4. **Send to Customer**: Paste the response in your communication tool

## API Endpoints

- `POST /api/chat` - Send customer question, get AI response
- `GET /health` - Health check endpoint

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **AI**: OpenAI GPT-4 API
- **Storage**: LocalStorage (for query history)

## File Structure

```
printo-cs-assistant-app/
├── server.js          # Express server with OpenAI integration
├── package.json       # Dependencies and scripts
├── .env              # Environment variables
├── README.md         # This file
├── index.html        # Main interface
├── script.js         # Frontend functionality
├── styles.css        # Styling
└── public/           # Static files
```

## Support

For issues or questions, contact the Printo development team.

---

**Made for Printo.in Customer Support Team** 🖨️