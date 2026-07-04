import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('*', async (req, res) => {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    
    if (!response.ok) {
      throw new Error(`OpenRouter API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.status(200).json({
      success: true,
      models: data.data || []
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error fetching models:`, error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch models",
      details: error.message
    });
  }
});

export default app;
