# Deck Quote Form

A lead capture form for deck building services with auto-advance UX and CRM webhook integration. Ready for Railway deployment.

## Features

- **Auto-advance fields** — form reveals progressively as user fills fields; cursor auto-moves on valid input (full phone number, valid email, service selection)
- **Phone auto-format** — inputs format as `(612) 555-0123` automatically
- **Webhook + API forwarding** — sends lead JSON to your CRM on submit
- **Rate limiting** — 10 submissions per IP per 15 minutes
- **Helmet security headers** — CSP, HSTS, etc.
- **Health check** — `GET /health` for Railway monitoring
- **Mobile responsive** — stacks to single column on small screens

## Lead Payload

Your webhook/API receives this JSON on each submission:

```json
{
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "phone": "(612) 555-0123",
  "service": "Custom Deck Building",
  "message": "Looking for a 400 sq ft composite deck...",
  "submittedAt": "2026-02-11T21:30:00.000Z",
  "source": "https://yourdomain.com/",
  "ip": "203.0.113.42"
}
```

## Quick Start

```bash
npm install
cp .env.example .env   # edit with your webhook URL
npm start              # → http://localhost:3000
```

## Deploy to Railway

1. Push this repo to GitHub
2. In [Railway](https://railway.app), create a new project → Deploy from GitHub repo
3. Add environment variables:
   - `WEBHOOK_URL` = your CRM webhook endpoint
   - `API_URL` + `API_KEY` (optional, for secondary integration)
   - `ALLOWED_ORIGINS` = your domain (e.g. `https://yourdomain.com`)
4. Railway auto-detects Node.js and deploys. The `railway.toml` handles the rest.

## Embed on Another Site

Once deployed, embed the form in an iframe:

```html
<iframe
  src="https://your-railway-url.up.railway.app"
  width="100%"
  height="750"
  frameborder="0"
  style="border: none; max-width: 600px; margin: 0 auto; display: block;"
></iframe>
```

## Services Available

Custom Deck Building · Hot Tub Decks · Pool Decks · Porch Decks · Cedar Decks · Composite Decks · Deck Repair & Restoration · Pergolas & Structures · Deck Stairs · Deck Railings · Deck Columns & Posts · Deck Lighting · Commercial Deck Building
