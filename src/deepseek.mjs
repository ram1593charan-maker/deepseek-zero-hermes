#!/usr/bin/env node
// src/deepseek.mjs — DeepSeek Web UI client using Playwright sessions
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIE_FILE = join(__dirname, '..', 'config', 'session.json');
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

let cachedCookies = null;

export async function loadCookies() {
  if (cachedCookies) return cachedCookies;
  if (!existsSync(COOKIE_FILE)) {
    throw new Error(`Session file not found: ${COOKIE_FILE}. Run 'npm run login' first.`);
  }
  const raw = readFileSync(COOKIE_FILE, 'utf-8');
  cachedCookies = JSON.parse(raw);
  return cachedCookies;
}

export async function makeRequest(messages, model = 'deepseek-chat') {
  const cookies = await loadCookies();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    cookies: cookies
  });
  const page = await context.newPage();

  // Navigate to DeepSeek chat to establish session
  await page.goto('https://chat.deepseek.com', { waitUntil: 'networkidle', timeout: 15000 });

  // Check if still logged in or on CAPTCHA
  const title = await page.title();
  const url = page.url();
  if (title.includes('Login') || title.includes('sign in')) {
    await browser.close();
    throw new Error('Session expired — re-run npm run login');
  }
  if (title.includes('Verify') || title.includes('captcha') || title.includes('human verification') || url.includes('/verify')) {
    await browser.close();
    throw new Error('CAPTCHA/human verification page detected. Please complete the CAPTCHA manually in the Chrome window on port 9222, then retry.');
  }

  // Send the chat message - try multiple selectors
  const inputSelector = 'textarea[placeholder*="message"], textarea[placeholder*="Ask"], textarea[placeholder*="send"], #input-area, [contenteditable="true"], .chat-input textarea, [aria-label*="message"]';
  const textarea = await page.waitForSelector(inputSelector, { timeout: 5000, state: 'visible' });
  await textarea.click();

  // Type the first message content
  const firstMsg = messages[0]?.content || '';
  await textarea.type(firstMsg, { delay: 20 });

  // Press Enter to send
  await page.keyboard.press('Enter');

  // Wait for response to appear
  await page.waitForTimeout(3000);

  // Wait for response to appear
  await page.waitForTimeout(2000);

  // Try to extract the response - look for markdown/code blocks
  const answer = await page.$eval('pre, code, .markdown, .prose, .response-content, [class*="answer"]', el => el.textContent().trim()).catch(() => '');

  await browser.close();
  return answer || 'No response extracted';
}

export async function checkSession() {
  const cookies = await loadCookies();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT, cookies });
  const page = await context.newPage();
  await page.goto('https://chat.deepseek.com', { waitUntil: 'networkidle', timeout: 10000 });
  const title = await page.title();
  const loggedIn = !title.includes('Login') && !title.includes('sign in');
  await browser.close();
  return { loggedIn, title };
}