import type { Page } from '@playwright/test'

export const MY_ID = 'test-p1'

/**
 * Injected before any page scripts run. Sets window.__mockSocket so that
 * socket.ts picks it up instead of creating a real socket.io connection.
 */
const MOCK_SCRIPT = `
(function () {
  var handlers = {};
  var emitted = [];
  window.__mockSocket = {
    id: 'test-p1',
    on: function (event, fn) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(fn);
    },
    off: function (event, fn) {
      if (!handlers[event]) return;
      if (fn !== undefined) {
        handlers[event] = handlers[event].filter(function (h) { return h !== fn; });
      } else {
        handlers[event] = [];
      }
    },
    emit: function (event, data) {
      emitted.push({ event: event, data: data });
    },
    __trigger: function (event, data) {
      (handlers[event] || []).forEach(function (h) { h(data); });
    },
    get __emitted() { return emitted.slice(); },
    __clear: function () { emitted.length = 0; }
  };
})();
`

/** Navigate to the app with the mock socket ready, then simulate a connect event. */
export async function setup(page: Page): Promise<void> {
  await page.addInitScript({ content: MOCK_SCRIPT })
  await page.goto('/')
  await page.evaluate(() => (window as any).__mockSocket.__trigger('connect'))
  await page.waitForSelector('.app-disconnect-overlay', { state: 'hidden', timeout: 5000 })
}

/** Emit a gameState event from the mock server to drive a screen transition. */
export async function pushState(page: Page, state: Record<string, unknown>): Promise<void> {
  await page.evaluate((s) => (window as any).__mockSocket.__trigger('gameState', s), state)
}

/** Return a snapshot of all socket.emit calls made by the app. */
export async function getEmitted(page: Page): Promise<Array<{ event: string; data: unknown }>> {
  return page.evaluate(() => (window as any).__mockSocket.__emitted)
}

/** Return the most recent socket.emit call, or undefined if none. */
export async function getLastEmit(page: Page): Promise<{ event: string; data: unknown } | undefined> {
  const all = await getEmitted(page)
  return all[all.length - 1]
}

/** Clear the recorded emit log. */
export async function clearEmits(page: Page): Promise<void> {
  await page.evaluate(() => (window as any).__mockSocket.__clear())
}
