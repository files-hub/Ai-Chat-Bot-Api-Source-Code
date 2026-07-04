import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ strict: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { success: false, error: "Rate limit exceeded. Try again later." },
});
app.use(limiter);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }
      throw new Error(`Transient error: ${response.status}`);
    } catch (error) {
      clearTimeout(timeoutId);
      if (i === retries - 1) throw error;
      await delay(1000 * (i + 1));
    }
  }
}

// ==========================================
// 1. GET Request (For URL: ?prompt=hi)
// ==========================================
app.get('*', async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ success: false, error: "Missing API Key" });

  // URL থেকে prompt এবং model নিবে (যেমন: ?prompt=hi&model=openai/gpt-4o-mini)
  const prompt = req.query.prompt || req.query.message; 
  const model = req.query.model || "openai/gpt-4o-mini"; // Default model

  if (!prompt) {
    return res.status(400).json({ 
      success: false, 
      error: "Please provide a prompt in the URL. Example: /api/chat?prompt=hello" 
    });
  }

  const payload = {
    model: model,
    messages: [{ role: "user", content: prompt }]
  };

  await sendToOpenRouter(res, payload, apiKey);
});

// ==========================================
// 2. POST Request (For JSON Body)
// ==========================================
app.post('*', async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ success: false, error: "Missing API Key" });

  const { model, message, messages, system_prompt, temperature = 0.7, max_tokens } = req.body;

  if (!model) return res.status(400).json({ success: false, error: "Missing model" });
  if (!message && !messages) return res.status(400).json({ success: false, error: "Missing message" });

  const conversation = [];
  if (system_prompt) conversation.push({ role: "system", content: system_prompt });
  if (messages) conversation.push(...messages);
  else if (message) conversation.push({ role: "user", content: message });

  const payload = { model, messages: conversation, temperature };
  if (max_tokens) payload.max_tokens = max_tokens;

  await sendToOpenRouter(res, payload, apiKey);
});

// ==========================================
// Core Function to Call OpenRouter
// ==========================================
async function sendToOpenRouter(res, payload, apiKey) {
  try {
    const response = await fetchWithRetry('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: "API Error", details: data });
    }

    const reply = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ success: true, reply, model: payload.model });

  } catch (error) {
    if (error.name === 'AbortError') return res.status(504).json({ success: false, error: "Request timeout" });
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

export default app;
