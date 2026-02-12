const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Configuration ───────────────────────────────────────────
// Set these in Railway environment variables
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://camwxepkxdzxmcnqahzj.supabase.co/functions/v1/inbound-lead-webhook";
const API_KEY = process.env.API_KEY || "";
const FORM_ID = process.env.FORM_ID || "fa19a175-f8e6-4d34-8f82-c4d7c75076fa";
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

    // Build CRM webhook payload (matches your Supabase inbound-lead-webhook format)
    const webhookPayload = {
      form_id: FORM_ID,
      source: "custom_form",
      lead: {
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone ? phone.trim() : "",
        zip_code: zipCode ? zipCode.trim() : "",
        service: service || "",
        financing: financing || "",
        message: message.trim(),
      },
    };

    console.log("[Lead received]", webhookPayload.lead.email, webhookPayload.lead.service || "no service selected");

    // Forward to CRM webhook
    if (WEBHOOK_URL && API_KEY) {
      try {
        await Promise.race([
          forwardToWebhook(WEBHOOK_URL, API_KEY, webhookPayload),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Webhook timeout")), 8000)),
        ]);
        console.log("[Webhook sent]", webhookPayload.lead.email);
      } catch (err) {
        console.error("[Webhook error]", err.message);
      }
    } else if (WEBHOOK_URL) {
      console.warn("⚠ WEBHOOK_URL set but no API_KEY — skipping webhook");
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

async function forwardToWebhook(url, apiKey, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Webhook returned ${response.status}: ${body}`);
  }
  return response;
}

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Deck Quote Form running on port ${PORT}`);
  console.log(`✓ Form ID: ${FORM_ID}`);
  if (WEBHOOK_URL && API_KEY) console.log(`✓ Webhook: ${WEBHOOK_URL.substring(0, 50)}...`);
  else console.log("⚠ Set API_KEY in Railway to enable webhook forwarding.");
});
