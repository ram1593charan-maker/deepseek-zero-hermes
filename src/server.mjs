#!/usr/bin/env node
// src/server.mjs — OpenAI-compatible HTTP gateway on :8766
// Endpoints: /v1/chat/completions, /v1/models, /health, /auth/status
import http from 'http';
import { makeRequest, checkSession } from './deepseek.mjs';

const PORT = process.env.PORT || 8766;
const HOST = '127.0.0.1';

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleChatCompletions(req, res) {
  try {
    const body = await parseBody(req);
    const model = body.model || 'deepseek-chat';
    const messages = body.messages || [];

    // Call DeepSeek via browser session
    const answer = await makeRequest(messages, model);

    const response = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: answer },
        finish_reason: 'stop'
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };

    jsonResponse(res, 200, response);
  } catch (err) {
    jsonResponse(res, 500, { error: { message: err.message, type: 'internal_error' } });
  }
}

async function handleModels(req, res) {
  jsonResponse(res, 200, {
    object: 'list',
    data: [
      { id: 'deepseek-chat', object: 'model', created: Math.floor(Date.now()/1000), owned_by: 'deepseek' },
      { id: 'deepseek-reasoner', object: 'model', created: Math.floor(Date.now()/1000), owned_by: 'deepseek' }
    ]
  });
}

async function handleHealth(req, res) {
  const session = await checkSession();
  jsonResponse(res, 200, { ok: true, session });
}

async function handleAuthStatus(req, res) {
  const session = await checkSession();
  jsonResponse(res, 200, { logged_in: session.loggedIn, last_ok_at: new Date().toISOString(), title: session.title });
}

const routes = {
  '/v1/chat/completions': handleChatCompletions,
  '/v1/models': handleModels,
  '/health': handleHealth,
  '/auth/status': handleAuthStatus
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const handler = routes[url.pathname];
  if (handler) {
    await handler(req, res);
  } else {
    jsonResponse(res, 404, { error: 'not found' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`DeepSeek zero-token gateway running on http://${HOST}:${PORT}`);
  console.log(`  /v1/chat/completions — OpenAI-compatible chat endpoint`);
  console.log(`  /v1/models — model list`);
  console.log(`  /health — health check`);
  console.log(`  /auth/status — session status`);
});