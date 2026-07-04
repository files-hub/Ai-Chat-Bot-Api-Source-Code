# 🚀 OpenRouter AI Chat API (Serverless)

A production-ready, highly robust AI Chat API built with **Node.js** and **Express**. Designed to be deployed seamlessly on **Vercel** as Serverless Functions. This API acts as a secure backend wrapper for **OpenRouter**, allowing you to integrate hundreds of AI models (OpenAI, Anthropic, Meta, Google, etc.) into your frontend applications without exposing your API keys.

---

## 📑 Table of Contents
- [✨ Features](#-features)
- [🏗 Architecture & Resilience](#-architecture--resilience)
- [🛠 Prerequisites](#-prerequisites)
- [💻 Local Setup & Installation](#-local-setup--installation)
- [☁️ Deployment (Vercel)](#-deployment-vercel)
- [📚 API Reference](#-api-reference)
  - [1. Server Status](#1-server-status)
  - [2. Fetch Models](#2-fetch-available-models)
  - [3. Chat Completions](#3-chat-completions-core-endpoint)
- [🔥 Advanced Usage Examples](#-advanced-usage-examples)
- [⚠️ Error Handling & Status Codes](#-error-handling--status-codes)

---

## ✨ Features
- **Serverless-First:** Configured directly for Vercel Edge/Serverless deployment (`vercel.json`).
- **Dynamic Model Selection:** Choose from 100+ OpenRouter models on the fly.
- **Conversation History:** Native support for multi-turn conversations (`system`, `user`, `assistant` roles).
- **Global CORS Configured:** Ready to be consumed by any frontend (React, Vue, Next.js, etc.).
- **Security:** API key remains securely in the backend environment variables. No frontend exposure.

## 🏗 Architecture & Resilience
This API isn't just a basic proxy; it includes enterprise-grade resilience features:
- **Rate Limiting:** Protects against spam by limiting IPs to **60 requests per 15 minutes** using `express-rate-limit`.
- **Exponential Backoff & Retries:** Automatically retries failed OpenRouter requests (up to 3 times) for transient errors (5xx network errors, timeouts) before failing.
- **Timeout Management:** Enforces a strict **30-second timeout** using `AbortController` to prevent serverless function hanging.
- **Strict Validation:** Rejects invalid JSON, missing parameters, and maps OpenRouter errors to standardized HTTP status codes.

---

## 🛠 Prerequisites
Before you begin, ensure you have:
1. **Node.js** (v18.x or higher) installed.
2. A free [Vercel Account](https://vercel.com).
3. Vercel CLI installed globally (`npm i -g vercel`).
4. An API Key from [OpenRouter](https://openrouter.ai/).

---

## 💻 Local Setup & Installation

**1. Clone the repository and install dependencies:**
```bash
git clone https://github.com/your-username/ai-chat-api.git
cd ai-chat-api
npm install
