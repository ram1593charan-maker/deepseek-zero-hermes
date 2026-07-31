#!/usr/bin/env node
// src/login.mjs — One-time cookie capture via Chrome remote debugging
// Launch Chrome with --remote-debugging-port=9222 so it's a real browser
// session (no CAPTCHA/bot detection).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '..', 'config');
const COOKIE_FILE = join(CONFIG_DIR, 'session.json');
const UA_FILE = join(CONFIG_DIR, 'user-agent.txt');
const DEBUG_PORT = 9222;
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

async function main() {
  mkdirSync(CONFIG_DIR, { recursive: true });

  console.log('='.repeat(60));
  console.log('  DeepSeek Login');
  console.log('='.repeat(60));
  console.log('');
  console.log('This will open Chrome with remote debugging on port 9222.');
  console.log('Sign into chat.deepseek.com in that Chrome window.');
  console.log('When you are logged in, press ENTER here.');
  console.log('');

  // Launch Chrome with remote debugging via CDP
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: [
      `--remote-debugging-port=${DEBUG_PORT}`,
      '--no-first-run',
      '--disable-default-apps',
      '--no-sandbox',
    ],
  });

  // Try to connect via CDP to the launched Chrome
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://chat.deepseek.com', { waitUntil: 'networkidle', timeout: 15000 });

    const title = await page.title();
    console.log(`Chrome opened. Page title: "${title}"`);

    const isLogin = title.toLowerCase().includes('login') || title.toLowerCase().includes('sign in');
    console.log(isLogin ? '⚠  Still on login screen — sign in now.' : '✓  Appears to be logged in already.');

    // Keep Chrome open so user can sign in if needed
    console.log('\nPress ENTER here once you are logged in to chat.deepseek.com...');

    process.stdin.once('data', async () => {
      try {
        const cookies = await context.cookies();
        writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
        writeFileSync(UA_FILE, USER_AGENT);
        console.log(`\n✓  Saved ${cookies.length} cookies to ${COOKIE_FILE}`);
        console.log(`✓  User-Agent saved to ${UA_FILE}`);
        console.log('✓  You can now start the gateway:');
        console.log('     node src/server.mjs');
        console.log('     curl -s http://127.0.0.1:8766/auth/status');
      } catch (err) {
        console.error('Error saving cookies:', err.message);
      }
      await browser.close();
      process.exit(0);
    });
  } catch (err) {
    console.error('Error navigating to DeepSeek:', err.message);
    await browser.close();
    process.exit(1);
  }
}

main();