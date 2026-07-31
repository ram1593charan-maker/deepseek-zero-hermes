#!/usr/bin/env node
// src/deepseek.mjs — DeepSeek Web UI client using Chrome 9222 remote debugging
// Reuses the live Chrome tab instead of opening a new headless browser.
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COOKIE_FILE = join(__dirname, '..', 'config', 'session.json');
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';
const CDP_URL = process.env.DEEPSEEK_CDP_URL || 'http://127.0.0.1:9222';
const CHAT_URL = 'https://chat.deepseek.com';

let cachedCookies = null;

export async function loadCookies() {
  if (cachedCookies) return cachedCookies;
  if (!existsSync(COOKIE_FILE)) {
    throw new Error(`Session file not found: ${COOKIE_FILE}. Run 'node src/login.mjs' first.`);
  }
  const raw = readFileSync(COOKIE_FILE, 'utf-8');
  cachedCookies = JSON.parse(raw);
  return cachedCookies;
}

async function getDeepSeekPage(cdpBrowser) {
  // Try to find an open DeepSeek tab
  const pages = await cdpBrowser.pages();
  let page = pages.find(p => p.url().includes('deepseek.com'));

  if (!page) {
    // Open a new tab and navigate to DeepSeek
    page = await cdpBrowser.newPage();
    await page.goto(CHAT_URL, { waitUntil: 'networkidle', timeout: 15000 });
  } else if (!page.url().includes(CHAT_URL)) {
    // Page exists but not on DeepSeek chat — navigate
    await page.goto(CHAT_URL, { waitUntil: 'networkidle', timeout: 15000 });
  }

  return page;
}

export async function makeRequest(messages, model = 'deepseek-chat') {
  const cookies = await loadCookies();

  // Connect to Chrome 9222 instead of launching own browser
  const browser = await chromium.connectOverCDP(CDP_URL);

  try {
    const page = await getDeepSeekPage(browser);

    // Check if we hit CAPTCHA or human verification
    const title = await page.title();
    if (title.includes('Verify') || title.includes('captcha') || title.includes('human verification')) {
      throw new Error('CAPTCHA/human verification page detected. Please complete CAPTCHA in Chrome window on port 9222, then retry.');
    }

    // Wait for input area
    await page.waitForTimeout(1000);
    const inputSelector = 'textarea[placeholder*="message"], textarea[placeholder*="Ask"], textarea[placeholder*="send"], #input-area, [contenteditable="true"], .chat-input textarea, [aria-label*="message"], textarea';

    const textarea = await page.waitForSelector(inputSelector, { timeout: 5000, state: 'visible' });
    await textarea.click();
    await textarea.fill('');

    // Type message
    const firstMsg = messages[0]?.content || '';
    await textarea.type(firstMsg, { delay: 30 });

    // Press Enter
    await page.keyboard.press('Enter');

    // Wait for response
    await page.waitForTimeout(5000);

    // Try to extract response text
    const answer = await page.$eval(
      'pre, code, .markdown, .prose, .response-content, [class*="answer"], [class*="response"]',
      el => el.textContent().trim()
    ).catch(() => '');

    return answer || 'No response extracted';
  } finally {
    // Disconnect from Chrome — don't close it
    await browser.close();
  }
}

export async function checkSession() {
  const cookies = await loadCookies();
  const browser = await chromium.connectOverCDP(CDP_URL);

  try {
    const page = await getDeepSeekPage(browser);
    const title = await page.title();
    const loggedIn = !title.includes('Login') && !title.includes('sign in') && !title.includes('Verify');
    return { loggedIn, title };
  } finally {
    await browser.close();
  }
}