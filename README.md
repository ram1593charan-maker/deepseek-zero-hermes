# deepseek-zero-hermes

DeepSeek zero-token API gateway for Hermes — OpenAI-compatible `/v1/chat/completions` via `chat.deepseek.com` browser session.

## How it works

1. **Login once** (Playwright headed browser): opens Chrome, you sign into DeepSeek, press ENTER. Cookies are saved to `config/session.json`.
2. **Gateway runs** on `127.0.0.1:8766` — Hermes can dial it as a custom provider.
3. **No API key needed** — uses a browser session, not a paid API key.

## Setup (Pranav's 20%)

```bash
cd /home/pranav/projects/deepseek-zero-hermes

# 1. Install deps
npm install

# 2. Start the gateway
node src/server.mjs &
# or use the systemd unit:
systemctl --user enable --now deepseek-zero

# 3. Login (first time only — Chrome pops up, sign in, press ENTER)
node src/login.mjs

# 4. Verify session
curl -s http://127.0.0.1:8766/auth/status

# 5. Smoke test
curl -s -X POST http://127.0.0.1:8766/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"Say pong"}]}'
```

## Hermes config

Add to `~/.hermes/config.yaml`:

```yaml
providers:
  deepseek-zero:
    api_key: not-required
    base_url: http://127.0.0.1:8766/v1
    model: deepseek-chat
    models:
      - deepseek-chat
      - deepseek-reasoner
```

Then add as fallback:

```yaml
fallback_providers:
  - model: deepseek-chat
    provider: deepseek-zero
```

## Test through Hermes

```bash
hermes chat --provider deepseek-zero --model deepseek-chat -q "What is 2+2?"
```

## Risk

- Violates DeepSeek web ToS — Dev/personal use only, not for Ads4You client work.
- Cookie sessions can expire — re-run `npm run login` if `/auth/status` shows stale or chat returns 401/403.
