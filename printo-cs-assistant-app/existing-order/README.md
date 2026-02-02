# Existing Order Status System

A **standalone, independent system** for customers to check the status of their existing orders using their phone number.

---

## System Architecture

```
Customer (Botspace)
    ↓
    ↓ (sends phone number)
    ↓
Webhook Endpoint (/api/existing-order/status)
    ↓
    ├─→ PIA Client (queries PIA API)
    │       ↓
    │   (fetches active orders)
    │       ↓
    └─→ Message Generator (GPT-powered)
            ↓
        (generates customer-friendly message)
            ↓
Response back to Botspace
```

---

## Components

### 1. **pia-client.js** - PIA API Integration
- Queries PIA API using phone number
- Filters **only active orders** (excludes completed, cancelled)
- Extracts Job ID, status, product info
- Handles phone number extraction from various formats

### 2. **message-generator.js** - GPT Status Messages
- Uses GPT-4o-mini to generate short, customer-friendly messages
- Includes Job ID and current status
- Handles single and multiple orders
- Fallback to simple messages if GPT fails

### 3. **webhook.js** - HTTP Endpoint
- Receives requests from Botspace
- Orchestrates PIA lookup + GPT generation
- Returns structured response

---

## API Endpoints

### **POST** `/api/existing-order/status`

Check order status by phone number.

**Request Body:**
```json
{
  "phone": "9940117071",
  "message": "9940117071"  // Optional: can extract phone from message
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Your order *Job ID: WEBKA/516914* is currently in *Production* and will be ready by Jan 30th.",
  "metadata": {
    "phone": "9940117071",
    "activeOrderCount": 1,
    "responseTime": 245,
    "timestamp": "2026-01-30T10:30:00Z"
  }
}
```

**Error Response (400 - Invalid Phone):**
```json
{
  "success": false,
  "error": "INVALID_PHONE",
  "message": "Please provide a valid 10-digit phone number."
}
```

**Error Response (500 - PIA Error):**
```json
{
  "success": false,
  "error": "PIA_ERROR",
  "message": "Unable to fetch order status at the moment. Please try again or call 9513734374 for assistance."
}
```

### **GET** `/api/existing-order/health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "Existing Order Status System",
  "timestamp": "2026-01-30T10:30:00Z",
  "version": "1.0.0"
}
```

---

## Environment Variables

Required in `.env` file:

```bash
# PIA API Configuration
PIA_API_URL=https://pia.printo.in/api/v1/legacy/chatbot/order-status/
PIA_BEARER_TOKEN=your_bearer_token_here
PIA_AUTH_URL=https://pia.printo.in/api/v1/auth/

# OpenAI API (for GPT message generation)
OPENAI_API_KEY=your_openai_key_here
```

---

## Testing

### Run Test Suite:
```bash
node existing-order/test.js
```

Make sure the server is running on port 3007 before running tests.

### Manual Testing with cURL:

```bash
# Test with phone number
curl -X POST http://localhost:3007/api/existing-order/status \
  -H "Content-Type: application/json" \
  -d '{"phone": "9940117071"}'

# Test with message containing phone
curl -X POST http://localhost:3007/api/existing-order/status \
  -H "Content-Type: application/json" \
  -d '{"message": "My number is 9940117071"}'

# Health check
curl http://localhost:3007/api/existing-order/health
```

---

## Flow Overview

1. **Customer Input (Botspace):**
   - Botspace collects phone number from customer
   - Sends phone number to webhook endpoint

2. **Backend Processing:**
   - Extract and validate phone number
   - Query PIA API for orders linked to phone

3. **Order Filtering:**
   - Filter only **active orders** (ignore completed/cancelled)
   - Extract Job ID, status for each active order

4. **Status Message Generation:**
   - GPT generates short, customer-friendly message
   - Includes Job ID(s) and current status
   - Concise and easy to understand

5. **Response:**
   - Send message back to Botspace
   - Botspace delivers to customer via WhatsApp

---

## Key Features

✅ **Standalone System** - Completely independent from New Order Assistant
✅ **Clean Architecture** - Minimal, production-ready code
✅ **Active Orders Only** - Filters out completed/cancelled orders
✅ **GPT-Powered Messages** - Natural, customer-friendly communication
✅ **Phone Extraction** - Handles various phone formats (with/without country code)
✅ **Error Handling** - Graceful fallbacks for PIA/GPT failures
✅ **Fast Response** - ~200-500ms average response time
✅ **Comprehensive Logging** - Detailed logs for debugging

---

## Active Order Status IDs

The system filters orders based on status IDs. Currently configured to exclude:

- `8000` - Delivered
- `9000` - Completed
- `9999` - Cancelled

All other status IDs are considered **active** and will be included in the response.

To modify this, edit the `inactiveStatusIds` array in `pia-client.js`.

---

## Deployment Notes

1. Ensure all environment variables are set in production `.env`
2. PIA Bearer token must be valid (expires periodically)
3. OpenAI API key must have sufficient credits
4. Botspace webhook should point to: `https://your-domain.com/api/existing-order/status`

---

## Support

For issues or questions, contact the development team or call customer support: **9513734374**
