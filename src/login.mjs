#!/usr/bin/env node
// src/login.mjs — One-time cookie capture via remote debugging on real Chrome
// Uses Chrome's remote debugging port so DeepSeek sees a real browser session (no CAPTCHA)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '..', 'config');
const COOKIE_FILE = join(CONFIG_DIR, 'session.json');
const UA_FILE = join(CONFIG_DIR, 'user-agent.txt');
const DEBUG_PORT = 9222;
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

async function startChrome() {
  // Try to connect to an existing Chrome with remote debugging on port 9222
  try {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
    console.log(`✓ Connected to existing Chrome on port ${DEBUG_PORT}`);
    return browser;
  } catch (e) {
    // No Chrome with remote debugging found — launch one ourselves
    console.log(`No Chrome on port ${DEBUG_PORT} found. Launching Chrome with remote debugging...`);
    console.log('Chrome will open normally. Sign in to chat.deepseek.com in that window.');
    console.log('After signing in, press ENTER here.');

    const browser = await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: [
        `--remote-debugging-port=${DEBUG_PORT}`,
        '--user-data-dir=/tmp/chrome-debug-profile',
      ],
    });
    console.log('Chrome launched with remote debugging on port 9222.');
    return browser;
  }
}

async function main() {
  mkdirSync(CONFIG_DIR, { recursive: true });

  console.log('='.repeat(60));
  console.log('  DeepSeek Login — Step by Step');
  console.log('='.repeat(60));
  console.log('');
  console.log('1. If Chrome is already open with remote debugging on port 9222,');
  console.log('   this script will connect to it automatically.');
  console.log('');
  console.log('2. If not, Chrome will launch with remote debugging enabled.');
  console.log('   A normal Chrome window will open — sign into chat.deepseek.com.');
  console.log('');
  console.log('3. Once you are logged in and see the chat page, press ENTER here.');
  console.log('');
  console.log('4. Cookies are saved to config/session.json automatically.');
  console.log('');

  const browser = await startChrome();
  const context = browser.contexts()[0];
  const page = await context.newPage();
  await page.goto('https://chat.deepseek.com', { waitUntil: 'networkidle', timeout: 15000 });

  const title = await page.title();
  console.log(`\nChrome page title: "${title}"`);

  // Check if showing login screen
  const isLogin = title.toLowerCase().includes('login') || title.toLowerCase().includes('sign in');
  console.log(isLogin ? '⚠ Still on login screen.' : '✓ Appears to be logged in already.');

  // Save cookies on ENTER
  console.log('\nWaiting for ENTER to save cookies...');
  process.stdin.once('data', async () => {
    try {
      const cookies = await context.cookies();
      writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
      writeFileSync(UA_FILE, USER_AGENT);
      console.log(`\n✓ Saved ${cookies.length} cookies to ${COOKIE_FILE}`);
      console.log(`✓ User-Agent saved to ${UA_FILE}`);
      console.log('✓ You can now start the gateway with: node src/server.mjs');
    } catch (err) {
      console.error('Error saving cookies:', err.message);
    }
    await browser.close();
    process.exit(0);
  });

  console.log('Press ENTER when ready...');
}

main();