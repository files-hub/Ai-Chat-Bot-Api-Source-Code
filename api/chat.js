import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();

// Trust Vercel's reverse proxy for accurate IP rate limiting
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ strict: true }));

// Rate Limiting Middleware: 60 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: "Rate limit exceeded. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Syntax Error Handler for Invalid JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ success: false, error: "Invalid JSON payload" });
  }
  next();
});

// Helper: Async Delay for Exponential Backoff
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Fetch with Timeout & Transient Error Retry
async function fetchWithRetry(url, options, retries = 3, timeoutMs = 30000) {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);

      // If success OR specific client error (except 429), return response immediately
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }

      // Throwing on 5xx and 429 to trigger retry block
      throw new Error(`Transient error: ${response.status}`);
    } catch (error) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw error; // Max retries reached
      await delay(1000 * (i + 1)); // Exponential backoff (1s, 2s, 3s)
    }
  }
}

app.post('*', async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ success: false, error: "Server configuration error: Missing API Key" });
  }

  const {
    model,
    message,
    messages,
    system_prompt,
    temperature = 0.7,
    max_tokens
  } = req.body;

  // Input Validation
  if (!model) {
    return res.status(400).json({ success: false, error: "Missing required field: model" });
  }

  if (!message && (!messages || !Array.isArray(messages) || messages.length === 0)) {
    return res.status(400).json({ success: false, error: "Missing required field: message or messages array" });
  }

  // Construct Conversation Array
  const conversation = [];

  if (system_prompt) {
    conversation.push({ role: "system", content: system_prompt });
  }

  if (messages && Array.isArray(messages)) {
    conversation.push(...messages);
  } else if (message) {
    conversation.push({ role: "user", content: message });
  }

  // OpenRouter Payload Setup
  const payload = {
    model,
    messages: conversation,
    temperature,
  };

  if (max_tokens) {
    payload.max_tokens = max_tokens;
  }

  try {
    console.log(`[${new Date().toISOString()}] Requesting Model: ${model}`);

    const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/ai-chat-api', 
        'X-Title': 'Production AI Chat API'
      },
      body: JSON.stringify(payload)
    }, 3, 30000); // 3 Retries, 30s Timeout

    const data = await response.json();

    // Map OpenRouter HTTP Errors to standardized responses
    if (!response.ok) {
      const status = response.status;
      if (status === 401) return res.status(401).json({ success: false, error: "Invalid API key or unauthorized" });
      if (status === 400 || status === 404) return res.status(400).json({ success: false, error: "Unsupported model or bad request", details: data });
      if (status === 429) return res.status(429).json({ success: false, error: "OpenRouter upstream rate limit exceeded" });

      return res.status(status).json({ success: false, error: "OpenRouter API error", details: data });
    }

    // Success response extraction
    const reply = data.choices?.[0]?.message?.content || "";
    const usage = data.usage || null;

    return res.status(200).json({
      success: true,
      reply,
      model: data.model || model,
      ...(usage && { usage }) // Includes usage stats if provided
    });

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Request failed:`, error.message);

    // Timeout Identification
    if (error.name === 'AbortError') {
      return res.status(504).json({ success: false, error: "Request timeout" });
    }

    return res.status(500).json({ success: false, error: "Internal server error", details: error.message });
  }
});

export default app;
