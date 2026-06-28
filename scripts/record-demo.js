/**
 * Records a .webm demo of Strength Coach using Playwright's built-in video.
 * Usage: node scripts/record-demo.js
 * Output: docs/demo.webm
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, '../docs');
fs.mkdirSync(DOCS_DIR, { recursive: true });

const DELAY = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('Launching browser…');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: {
      dir: DOCS_DIR,
      size: { width: 1280, height: 800 },
    },
  });

  const page = await context.newPage();

  console.log('→ Hero screen');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await DELAY(1800);

  console.log('→ Clicking "Log a Set"');
  await page.locator('.suggestion-card').first().click();
  await DELAY(600);

  // Wait for the first coach response to stream in
  console.log('→ Waiting for coach reply…');
  await page.waitForSelector('.message-wrapper.model', { timeout: 35000 });
  await DELAY(4000); // let streaming finish

  console.log('→ Typing a set');
  const input = page.locator('textarea').first();
  await input.click();
  for (const ch of 'Bench press 80kg x 5') {
    await input.type(ch, { delay: 55 });
  }
  await DELAY(900);

  console.log('→ Sending');
  await page.keyboard.press('Enter');
  await DELAY(600);

  // Wait for Set Logged card or any new model message
  console.log('→ Waiting for tool card + coaching reply…');
  try {
    await page.waitForSelector('text=Set Logged', { timeout: 30000 });
  } catch {
    // card text may vary; give extra time for streaming
    await DELAY(3000);
  }
  await DELAY(4500); // let coaching reply stream fully

  console.log('→ Opening Training Log');
  await page.locator('text=Training Log').first().click();
  await DELAY(2200);

  console.log('→ Done — closing browser');
  await context.close(); // flushes video
  await browser.close();

  // Playwright saves the video with a generated name; rename to demo.webm
  const files = fs.readdirSync(DOCS_DIR).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    const src = path.join(DOCS_DIR, files[files.length - 1]);
    const dest = path.join(DOCS_DIR, 'demo.webm');
    fs.renameSync(src, dest);
    console.log(`\n✅  Saved: docs/demo.webm`);
  } else {
    console.error('No .webm file found — check that the app was running.');
    process.exit(1);
  }
})();
