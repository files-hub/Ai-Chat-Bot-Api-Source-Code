import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.all('*', (req, res) => {
  res.status(200).json({
    status: "online",
    service: "AI Chat API",
    version: "1.0.0",
    uptime: true
  });
});

export default app;
