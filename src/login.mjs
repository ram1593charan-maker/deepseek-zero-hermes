#!/usr/bin/env node
// src/login.mjs — One-time cookie capture via Chrome remote debugging port 9222
// Connects to an existing Chrome with remote debugging, opens DeepSeek chat,
// and saves cookies when you press ENTER.
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
  console.log('Chrome should already be open with remote debugging on port 9222.');
  console.log('If not, close this script and start Chrome manually:');
  console.log('  google-chrome --remote-debugging-port=9222');
  console.log('');
  console.log('Sign into chat.deepseek.com in that Chrome window.');
  console.log('When you are logged in and see the chat, press ENTER here.');
  console.log('');

  // Connect to existing Chrome via CDP
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
  console.log('✓ Connected to Chrome on port 9222');

  // Get or create a context with DeepSeek
  let context = browser.contexts().find(c => {
    const pages = c.pages();
    return pages.some(p => p.url().includes('deepseek.com'));
  });

  if (!context) {
    context = browser.contexts()[0];
  }

  const page = await context.newPage();
  await page.goto('https://chat.deepseek.com', { waitUntil: 'networkidle', timeout: 15000 });

  const title = await page.title();
  console.log(`\nPage title: "${title}"`);

  const isLogin = title.toLowerCase().includes('login') || title.toLowerCase().includes('sign in');
  console.log(isLogin ? '⚠  Still on login screen — sign in now in the Chrome window.' : '✓  Appears to be logged in already.');

  // Save cookies on ENTER
  console.log('\nPress ENTER once you are logged in to save cookies...');

  process.stdin.once('data', async () => {
    try {
      const cookies = await context.cookies();
      writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
      writeFileSync(UA_FILE, USER_AGENT);
      console.log(`\n✓  Saved ${cookies.length} cookies to ${COOKIE_FILE}`);
      console.log(`✓  User-Agent saved to ${UA_FILE}`);
      console.log('\n✓  Ready to start the gateway:');
      console.log('     cd /home/pranav/projects/deepseek-zero-hermes');
      console.log('     node src/server.mjs');
      console.log('     curl -s http://127.0.0.1:8766/auth/status');
    } catch (err) {
      console.error('Error saving cookies:', err.message);
    }
    await browser.close();
    process.exit(0);
  });

  console.log('Waiting for ENTER...');
  // Keep the process alive
  await new Promise(() => {});
}

main();