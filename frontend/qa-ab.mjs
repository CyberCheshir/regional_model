import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(
  'C:/Users/kiril/.vscode/extensions/danielsanmedium.dscodegpt-3.24.72/standalone/',
);
const { chromium } = require('patchright');

const srv = spawn('D:/nodejs/npm.cmd', ['run', 'dev'], {
  cwd: 'd:/projects/regional_model/frontend',
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const base = 'http://localhost:5173/';
const reach = async () => {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 800);
    const r = await fetch(base, { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
};
const deadline = Date.now() + 25000;
while (Date.now() < deadline && !(await reach())) await new Promise((r) => setTimeout(r, 500));

let out = { serverUp: await reach() };
if (out.serverUp) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('UNCAUGHT ' + String(e).slice(0, 200)));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  out.styles = await page.evaluate(() => {
    const bar = document.querySelector('.activity-bar');
    const item = document.querySelector('.activity-bar__item');
    const active = document.querySelector('.activity-bar__item.is-active');
    const cs = (el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, color: s.color, borderRight: s.borderRightColor };
    };
    return {
      bar: cs(bar),
      item: cs(item),
      active: active ? cs(active) : 'none',
    };
  });
  await page.screenshot({ path: 'd:/projects/regional_model/frontend/qa-ab.png', clip: { x: 0, y: 40, width: 900, height: 260 } });
  out.errors = [...new Set(errors)].slice(0, 10);
  await browser.close();
} else {
  out.log = 'down';
}
console.log(JSON.stringify(out, null, 1));
srv.kill();
process.exit(0);
