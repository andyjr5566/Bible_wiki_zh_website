// 極簡 CDP 驅動：啟動自己的 headless Chrome（固定前綴的 user-data-dir），回傳 send/close。
// 用法見 shoot-ref.mjs。只關自己開的 Chrome。
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1440, height = 900, mobile = false, dpr = 1, port = 9333, headless = true, gpu = false, ua = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'jfshoot-'));
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
    `--window-size=${width},${height}`,
  ];
  if (!gpu) args.push('--enable-unsafe-swiftshader', '--use-angle=swiftshader');
  else args.push('--use-angle=d3d11', '--enable-gpu-rasterization');
  if (headless) args.unshift('--headless=new');
  const proc = spawn(CHROME, [...args, 'about:blank'], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch {}
    await sleep(250);
  }
  if (!ws) throw new Error('Chrome 沒有開起來');
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) listeners.forEach((fn) => fn(msg));
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  if (ua) await send('Network.setUserAgentOverride', { userAgent: ua });
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const consoleLog = [];
  listeners.push((m) => {
    if (m.method === 'Runtime.consoleAPICalled') consoleLog.push(`[${m.params.type}] ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    if (m.method === 'Runtime.exceptionThrown') consoleLog.push(`[exception] ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
  const shot = async (file) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(file, Buffer.from(data, 'base64'));
  };
  const wheel = async (dy, x = width / 2, y = height / 2) =>
    send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy });
  const click = async (x, y) => {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  };
  const close = async () => { try { await send('Browser.close'); } catch {} try { proc.kill(); } catch {} };
  const onEvent = (fn) => listeners.push(fn);
  return { send, evaluate, shot, wheel, click, close, consoleLog, dir, onEvent };
}
