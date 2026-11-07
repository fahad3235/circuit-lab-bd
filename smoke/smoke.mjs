// Circuit Lab BD headless-Chrome smoke test (raw CDP, headless_shell).
// Run: node smoke/smoke.mjs
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file://' + path.resolve(DIR, '..', 'index.html');
const CHROME = process.env.HEADLESS_SHELL ||
  (process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell');
const PORT = 9235;
const PROFILE = fs.mkdtempSync(path.join(os.tmpdir(), 'clbd-smoke-'));

const results = [];
function check(name, cond, extra) {
  results.push([name, !!cond]);
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (extra !== undefined ? ' :: ' + extra : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (await fn()) return true; } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('timeout waiting for: ' + label);
}

async function main() {
  const child = spawn(CHROME, [
    '--headless', '--no-sandbox', '--disable-gpu',
    '--user-data-dir=' + PROFILE,
    '--remote-debugging-port=' + PORT, '--remote-debugging-address=127.0.0.1',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    let version = null;
    await waitFor(async () => {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      if (!res.ok) return false;
      version = await res.json();
      return true;
    }, 20000, 'debugger port');
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    const consoleErrors = [];
    const exceptions = [];
    const onMsg = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        exceptions.push(msg.params.exceptionDetails.exception?.description || 'exception');
      }
    };
    ws.onmessage = onMsg;
    const send = (method, params) => new Promise((res, rej) => {
      const mid = ++id;
      pending.set(mid, { res, rej });
      ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
    const target = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' })).json();
    const tws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { tws.onopen = res; tws.onerror = rej; });
    const tpending = new Map();
    let tid = 0;
    tws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && tpending.has(msg.id)) {
        const { res, rej } = tpending.get(msg.id);
        tpending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        exceptions.push(msg.params.exceptionDetails.exception?.description || 'exception');
      }
    };
    const tsend = (method, params) => new Promise((res, rej) => {
      const mid = ++tid;
      tpending.set(mid, { res, rej });
      tws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
    const teval = async (expr) => {
      const r = await tsend('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
      return r.result.value;
    };
    await tsend('Runtime.enable');
    await tsend('Page.enable');
    await tsend('Page.navigate', { url: PAGE });
    await waitFor(async () => (await teval('document.querySelectorAll(".part-row").length')) === 3, 10000, 'default parts render');

    // 1. Static render: default simple loop (9V + 100R + 30R bulb).
    check('app title is Circuit Lab BD', await teval('document.querySelector("h1").textContent') === 'Circuit Lab BD');
    check('3 default part rows render', (await teval('document.querySelectorAll(".part-row").length')) === 3);
    check('schematic SVG has wire + glyphs', (await teval('document.querySelectorAll("#schematic-svg *").length')) > 5);
    check('6 current dots animate (flowing)', (await teval('document.querySelectorAll("#schematic-svg animateMotion").length')) === 6);
    check('total resistance shows 130.0 \u03a9', await teval('document.getElementById("readings-box").textContent.includes("130.0")'));
    check('current shows 69.2 mA', await teval('document.getElementById("readings-box").textContent.includes("69.2 mA")'));
    check('6 preset buttons render', (await teval('document.querySelectorAll(".preset-btn").length')) === 6);
    check('8 quiz options? no: 4 options for Q1', (await teval('document.querySelectorAll(".quiz-opt").length')) === 4);
    check('footer disclaimer mentions mains', await teval('document.querySelector(".foot").textContent.includes("mains")'));

    // 2. Builder: add a resistor -> 4 rows; remove it -> 3 rows.
    await teval('document.getElementById("add-resistor").click()');
    await sleep(300);
    check('add resistor -> 4 part rows', (await teval('document.querySelectorAll(".part-row").length')) === 4);
    check('current drops after adding 100\u03a9 (now 230\u03a9)', await teval('document.getElementById("readings-box").textContent.includes("39.1 mA")'));
    await teval('document.querySelectorAll("[data-remove]")[3].click()');
    await sleep(300);
    check('remove restores 3 part rows', (await teval('document.querySelectorAll(".part-row").length')) === 3);
    check('current back to 69.2 mA', await teval('document.getElementById("readings-box").textContent.includes("69.2 mA")'));

    // 3. Presets: parallel pair -> 50\u03a9, 180 mA; branch rows shown.
    await teval('document.querySelector("[data-preset=parallel]").click()');
    await sleep(300);
    check('parallel preset: total R 50.0 \u03a9', await teval('document.getElementById("readings-box").textContent.includes("50.0")'));
    check('parallel preset: current 180.0 mA', await teval('document.getElementById("readings-box").textContent.includes("180.0 mA")'));
    check('parallel branch rows render', (await teval('document.querySelectorAll(".read-table tr.sub").length')) === 2);

    // 4. Open-switch preset: no current + warning; short preset: short warning.
    await teval('document.querySelector("[data-preset=switch]").click()');
    await sleep(300);
    check('open switch: 0 A current', await teval('document.getElementById("readings-box").textContent.includes("0 A")'));
    check('open switch: no dots animate', (await teval('document.querySelectorAll("#schematic-svg animateMotion").length')) === 0);
    check('open switch: warning shown', await teval('document.getElementById("readings-box").textContent.includes("switch is open")'));
    await teval('document.querySelector("[data-preset=short]").click()');
    await sleep(300);
    check('short preset: short-circuit warning shown', await teval('document.getElementById("readings-box").textContent.includes("Short circuit!")'));

    // 5. Ohm's calculator: V=12, I=3 -> R=4.00, P=36.00; error on one value.
    await teval('document.querySelector("[data-preset=simple]").click()');
    await sleep(300);
    await teval('document.getElementById("ohms-v").value = "12"; document.getElementById("ohms-i").value = "3"; document.getElementById("ohms-solve").click()');
    await sleep(300);
    check('ohms V=12 I=3 -> R 4.00', await teval('document.getElementById("ohms-result").textContent.includes("4.00")'));
    check('ohms V=12 I=3 -> P 36.00', await teval('document.getElementById("ohms-result").textContent.includes("36.00")'));
    await teval('document.getElementById("ohms-clear").click(); document.getElementById("ohms-v").value = "12"; document.getElementById("ohms-solve").click()');
    await sleep(300);
    check('ohms one value -> need-two error', await teval('document.getElementById("ohms-result").textContent.includes("exactly two")'));
    await teval('document.getElementById("ohms-clear").click()');

    // 6. Quiz: correct answer on Q1 -> feedback + score; next -> Q2.
    await teval('document.querySelector("[data-opt=\\"1\\"]").click()');
    await sleep(300);
    check('quiz Q1 correct -> feedback Correct!', await teval('document.getElementById("quiz-feedback").textContent.includes("Correct!")'));
    check('quiz Q1 correct option marked', (await teval('document.querySelectorAll(".quiz-opt.correct").length')) === 1);
    await teval('document.getElementById("quiz-next").click()');
    await sleep(300);
    check('quiz advances to question 2', await teval('document.querySelector(".quiz-progress").textContent.includes("2 of 8")'));
    check('quiz score shows 1 after correct Q1', await teval('document.querySelector(".quiz-progress").textContent.includes("Score: 1")'));
    await teval('document.querySelector("[data-opt=\\"0\\"]").click()');
    await sleep(300);
    check('quiz wrong answer -> feedback Not quite', await teval('document.getElementById("quiz-feedback").textContent.includes("Not quite")'));

    // 7. Language toggle to Bangla + persistence.
    await teval('document.getElementById("lang-toggle").click()');
    await sleep(300);
    check('title switches to Bengali', await teval('document.querySelector("h1").textContent') === '\u09b8\u09be\u09b0\u09cd\u0995\u09bf\u099f \u09b2\u09cd\u09af\u09be\u09ac \u09ac\u09bf\u09a1\u09bf');
    check('html lang switches to bn', await teval('document.documentElement.lang') === 'bn');
    check('current shows Bengali digits', await teval('document.getElementById("readings-box").textContent.includes("\u09ec\u09ef.\u09e8 mA")'));
    await tsend('Page.navigate', { url: PAGE });
    await waitFor(async () => (await teval('document.querySelectorAll(".part-row").length')) === 3, 10000, 'reload BN');
    check('Bangla still active after reload', await teval('document.querySelector("h1").textContent') === '\u09b8\u09be\u09b0\u09cd\u0995\u09bf\u099f \u09b2\u09cd\u09af\u09be\u09ac \u09ac\u09bf\u09a1\u09bf');
    check('circuit persists after reload (69.2 mA in BN digits)', await teval('document.getElementById("readings-box").textContent.includes("\u09ec\u09ef.\u09e8 mA")'));
    await teval('document.getElementById("lang-toggle").click()');
    await sleep(300);
    check('toggle back to English', await teval('document.querySelector("h1").textContent') === 'Circuit Lab BD');

    // 8. Mobile 390px: no horizontal overflow.
    await tsend('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(500);
    check('no overflow at 390px', await teval('document.documentElement.scrollWidth <= 391'));

    // 9. No console errors / exceptions.
    check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
    check('zero page exceptions', exceptions.length === 0, exceptions.join(' | '));

    tws.close(); ws.close();
  } finally {
    child.kill();
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }
  const failed = results.filter((r) => !r[1]).length;
  console.log(failed === 0 ? 'SMOKE PASS: ' + results.length + '/' + results.length : 'SMOKE FAIL: ' + failed + ' failures');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('SMOKE ERROR:', e.message); process.exit(1); });
