#!/usr/bin/env node
// src/login.mjs — One-time Playwright cookie+UA capture for chat.deepseek.com
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '..', 'config');
const COOKIE_FILE = join(CONFIG_DIR, 'session.json');
const UA_FILE = join(CONFIG_DIR, 'user-agent.txt');

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

async function main() {
  mkdirSync(CONFIG_DIR, { recursive: true });

  console.log('Launching browser — sign into chat.deepseek.com in the browser window...');
  console.log('After logging in, press ENTER in this terminal.');

  const browser = await chromium.launch({ headless: false }); // headed so user sees the login
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  await page.goto('https://chat.deepseek.com', { waitUntil: 'networkidle', timeout: 15000 });

  // Save cookies on ENTER
  process.stdin.once('data', async () => {
    const cookies = await context.cookies();
    writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
    writeFileSync(UA_FILE, USER_AGENT);
    console.log(`\n✓ Cookies saved to ${COOKIE_FILE}`);
    console.log(`✓ User-Agent saved to ${UA_FILE}`);
    console.log(`✓ Session has ${cookies.length} cookies`);
    await browser.close();
    process.exit(0);
  });

  console.log('Waiting for ENTER...');
}

main();