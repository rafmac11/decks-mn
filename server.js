const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Configuration ───────────────────────────────────────────
// Set these in Railway environment variables
const WEBHOOK_URL = process.env.WEBHOOK_URL || "";
const API_URL = process.env.API_URL || "";
const API_KEY = process.env.API_KEY || "";
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["*"];

// ─── Middleware ───────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
      },
    },
  })
);
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Rate limiter: 10 submissions per IP per 15 min
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: "Too many submissions. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Routes ──────────────────────────────────────────────────

// Health check (useful for Railway)
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Form submission endpoint
app.post("/api/submit", submitLimiter, async (req, res) => {
  try {
    const { fullName, email, phone, service, message, zipCode, financing } = req.body;

    // Validate required fields
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ success: false, error: "Full name is required." });
    }
    if (!email || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: "A valid email address is required." });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: "Please include a message about your project." });
    }

    // Build lead payload
    const lead = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : "",
      service: service || "",
      zipCode: zipCode ? zipCode.trim() : "",
      financing: financing || "",
      message: message.trim(),
      submittedAt: new Date().toISOString(),
      source: req.headers.referer || "direct",
      ip: req.ip,
    };

    console.log("[Lead received]", lead.email, lead.service || "no service selected");

    // Forward to webhook (fire-and-forget style, but we log errors)
    const webhookResults = [];

    if (WEBHOOK_URL) {
      webhookResults.push(
        forwardToWebhook(WEBHOOK_URL, lead).catch((err) => {
          console.error("[Webhook error]", err.message);
          return { error: err.message };
        })
      );
    }

    if (API_URL) {
      webhookResults.push(
        forwardToAPI(API_URL, API_KEY, lead).catch((err) => {
          console.error("[API error]", err.message);
          return { error: err.message };
        })
      );
    }

    // Wait for integrations (with a 8s timeout so user isn't stuck)
    if (webhookResults.length > 0) {
      await Promise.race([
        Promise.allSettled(webhookResults),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    }

    res.json({ success: true, message: "Quote request submitted successfully!" });
  } catch (err) {
    console.error("[Submit error]", err);
    res.status(500).json({ success: false, error: "Something went wrong. Please try again." });
  }
});

// Catch-all: serve the form
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Integration helpers ─────────────────────────────────────

async function forwardToWebhook(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}`);
  }
  return response;
}

async function forwardToAPI(url, apiKey, payload) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }
  return response;
}

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Deck Quote Form running on port ${PORT}`);
  if (WEBHOOK_URL) console.log(`✓ Webhook: ${WEBHOOK_URL.substring(0, 40)}...`);
  if (API_URL) console.log(`✓ API: ${API_URL.substring(0, 40)}...`);
  if (!WEBHOOK_URL && !API_URL) {
    console.log("⚠ No WEBHOOK_URL or API_URL configured. Leads will only be logged to console.");
  }
});
