import express from 'express';
import cors from 'cors';

const app = express();

// Core Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ProxiSpeak Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default app;
