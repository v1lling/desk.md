/**
 * Regenerate the README header banner and app screenshots.
 *
 * One command — `npm run screenshots` — produces a consistent set of light and
 * dark images in `assets/`, so the README never shows a stale UI.
 *
 * How it works:
 *  - Runs the app in browser mock mode (`npm run dev`, port 3001). If a dev
 *    server is already up it is reused; otherwise one is started and stopped.
 *  - Seeds localStorage so onboarding is skipped and the theme + workspace are
 *    deterministic, then screenshots each page in light and dark.
 *  - Frames every page shot as a macOS-style window (rounded corners, soft
 *    shadow, traffic-light dots) by compositing in a second pass.
 *  - Renders the header banner from an inline HTML template (app icon + Geist
 *    wordmark), so it stays on-brand and regeneratable with no design tool.
 *
 * Pass `--banner-only` (`npm run screenshots:banner`) to regenerate just the
 * header banner — it is pure HTML, needs no dev server, and runs in seconds.
 *
 * Requirements: Node 22 (`nvm use 22`) and the Playwright Chromium browser
 * (`npx playwright install chromium`, one time).
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "assets");
const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

// Logical viewport; deviceScaleFactor 2 gives crisp retina PNGs.
// Width is sized so the three default Kanban columns sit snug with no dead
// space: sidebar 224 + handle 4 + main px-4 (32) + 3×280 columns + 2×12 gaps.
const VIEWPORT = { width: 1128, height: 760 };
const THEMES = /** @type {const} */ (["light", "dark"]);

/**
 * Pages to capture. `route` is opened directly; `?open=` deep-links a tab.
 * `prep` runs extra interaction (the Docs page needs an item opened).
 */
const PAGES = [
  { name: "dashboard", route: "/" },
  { name: "tasks", route: "/tasks" },
  { name: "projects", route: "/projects?open=website-redesign" },
  { name: "meetings", route: "/meetings?open=client-kickoff" },
  {
    name: "docs",
    route: "/docs",
    prep: async (page) => {
      // The Docs page main pane is empty until a doc is opened. The tree groups
      // docs under project folders (named by project id) — expand one, then
      // open a doc so the editor fills the pane.
      await page
        .getByRole("treeitem", { name: /website-redesign/ })
        .click({ timeout: 10_000 });
      await page.waitForTimeout(500);
      await page
        .getByRole("treeitem", { name: "Project Brief", exact: true })
        .click({ timeout: 10_000 });
      await page.waitForTimeout(700);
    },
  },
];

// ── Dev server ──────────────────────────────────────────────────────────────

async function serverIsUp() {
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await serverIsUp()) return;
    await sleep(500);
  }
  throw new Error(`Dev server did not come up on ${BASE_URL} in time.`);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** localStorage seed so the app boots straight into a deterministic state. */
function seedScript(theme) {
  const boot = { state: { dataPath: "~/Desk", setupCompleted: true }, version: 0 };
  const navigation = { state: { currentWorkspaceId: "acme" }, version: 0 };
  const preferences = {
    state: {
      theme,
      sidebarWidth: 224,
      workDayStartHour: 9,
      workDayEndHour: 18,
      showWeekends: false,
      secondarySidebarWidth: 280,
      secondarySidebarCollapsed: false,
      dismissedUpdateVersion: null,
    },
    version: 0,
  };
  return `
    localStorage.setItem("desk-boot", ${JSON.stringify(JSON.stringify(boot))});
    localStorage.setItem("desk-navigation", ${JSON.stringify(JSON.stringify(navigation))});
    localStorage.setItem("desk-preferences", ${JSON.stringify(JSON.stringify(preferences))});
  `;
}

/** Wait until the app shell has hydrated and mock data is showing. */
async function waitForApp(page) {
  await page.waitForSelector("text=Acme Co", { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
}

// ── Banner ──────────────────────────────────────────────────────────────────

function bannerHtml(theme, iconB64, fontB64) {
  const c =
    theme === "dark"
      ? { fg: "#fafafa", muted: "#a1a1aa", faint: "#71717a" }
      : { fg: "#0a0a0a", muted: "#71717a", faint: "#a1a1aa" };
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face {
      font-family: 'Geist';
      src: url(data:font/woff2;base64,${fontB64}) format('woff2');
      font-weight: 100 900;
    }
    * { margin: 0; box-sizing: border-box; }
    html, body { background: transparent; }
    /* inline-flex shrink-wraps the content, so the element screenshot below has
       no dead space — the banner PNG is exactly the icon + text + this padding. */
    .banner {
      display: inline-flex; align-items: center; gap: 40px;
      padding: 44px 60px;
      font-family: 'Geist', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .banner img { width: 156px; height: 156px; border-radius: 35px; }
    .name { font-size: 66px; font-weight: 600; letter-spacing: -0.04em; color: ${c.fg}; line-height: 1; }
    .tag { font-size: 23px; font-weight: 400; letter-spacing: -0.01em; color: ${c.muted}; margin-top: 16px; }
    .feat { font-size: 19px; font-weight: 500; letter-spacing: 0.01em; color: ${c.faint}; margin-top: 7px; }
  </style></head><body>
    <div class="banner">
      <img src="data:image/png;base64,${iconB64}" alt="">
      <div>
        <div class="name">desk.md</div>
        <div class="tag">Project &amp; task management in plain Markdown</div>
        <div class="feat">lightweight · local-first · agent-ready</div>
      </div>
    </div>
  </body></html>`;
}

async function captureBanner(browser, theme, iconB64, fontB64) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 500 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.setContent(bannerHtml(theme, iconB64, fontB64), {
    waitUntil: "load",
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const file = path.join(OUT_DIR, `banner-${theme}.png`);
  // Screenshot the .banner element, not the viewport — the PNG fits the content.
  await page.locator(".banner").screenshot({ path: file, omitBackground: true });
  await context.close();
  console.log(`  ✓ banner-${theme}.png`);
}

// ── Window framing ──────────────────────────────────────────────────────────

/** HTML that wraps a raw screenshot in a macOS-style window. */
function frameHtml(pngB64, w, h, pad) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; box-sizing: border-box; }
    html, body { width: ${w + pad * 2}px; height: ${h + pad * 2}px; background: transparent; }
    body { display: flex; align-items: center; justify-content: center; }
    .window {
      position: relative; width: ${w}px; height: ${h}px;
      border-radius: 20px; overflow: hidden;
      box-shadow: 0 24px 70px -16px rgba(0,0,0,0.35), 0 8px 24px -8px rgba(0,0,0,0.22);
    }
    .window img { display: block; width: ${w}px; height: ${h}px; }
    /* Traffic-light dots, overlaid in the app's (empty) title-bar strip. */
    .dots {
      position: absolute; top: 0; left: 0; height: 80px;
      display: flex; align-items: center; gap: 16px; padding-left: 40px;
    }
    .dot { width: 24px; height: 24px; border-radius: 50%; }
  </style></head><body>
    <div class="window">
      <img src="data:image/png;base64,${pngB64}" alt="">
      <div class="dots">
        <span class="dot" style="background:#ff5f57"></span>
        <span class="dot" style="background:#febc2e"></span>
        <span class="dot" style="background:#28c840"></span>
      </div>
    </div>
  </body></html>`;
}

/** Composite a raw screenshot into a framed macOS window; write it to `outPath`. */
async function frameWindow(browser, rawBuffer, outPath) {
  const w = VIEWPORT.width * 2; // raw image is captured at deviceScaleFactor 2
  const h = VIEWPORT.height * 2;
  const pad = 110; // transparent margin for the drop shadow
  const context = await browser.newContext({
    viewport: { width: w + pad * 2, height: h + pad * 2 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.setContent(frameHtml(rawBuffer.toString("base64"), w, h, pad), {
    waitUntil: "load",
  });
  await page.screenshot({ path: outPath, omitBackground: true });
  await context.close();
}

// ── Page screenshots ────────────────────────────────────────────────────────

async function capturePages(browser, theme) {
  for (const shot of PAGES) {
    // Fresh context per shot — guarantees a clean tab bar (opening a doc or
    // meeting in one shot must not bleed into the next).
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 2,
      colorScheme: theme,
    });
    await context.addInitScript(seedScript(theme));
    const page = await context.newPage();

    await page.goto(`${BASE_URL}${shot.route}`, { waitUntil: "domcontentloaded" });
    await waitForApp(page);
    if (shot.prep) await shot.prep(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const raw = await page.screenshot();
    await context.close();

    // Second pass: wrap the raw shot in a macOS window frame.
    await frameWindow(browser, raw, path.join(OUT_DIR, `${shot.name}-${theme}.png`));
    console.log(`  ✓ ${shot.name}-${theme}.png`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Lazy import so a missing dependency gives a clear message.
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("Playwright is not installed. Run: npm install");
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });

  const iconPath = path.join(ROOT, "icon.png");
  const fontPath = path.join(
    ROOT,
    "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
  );
  if (!existsSync(iconPath) || !existsSync(fontPath)) {
    console.error("Missing icon.png or the Geist font (run npm install first).");
    process.exit(1);
  }
  const iconB64 = (await readFile(iconPath)).toString("base64");
  const fontB64 = (await readFile(fontPath)).toString("base64");

  // `--banner-only` regenerates just the header banner (pure HTML, no app), so
  // the dev server and per-page shots are skipped.
  const bannerOnly = process.argv.includes("--banner-only");

  // Start the dev server only if one isn't already running.
  let devServer = null;
  if (bannerOnly) {
    console.log("Banner-only run — skipping the dev server and app screenshots.");
  } else if (await serverIsUp()) {
    console.log(`Reusing dev server on ${BASE_URL}`);
  } else {
    console.log("Starting dev server…");
    devServer = spawn("npm", ["run", "dev"], {
      cwd: ROOT,
      stdio: "ignore",
      detached: false,
    });
    await waitForServer();
    console.log(`Dev server ready on ${BASE_URL}`);
  }

  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error("\nCould not launch Chromium. Install it once with:");
    console.error("  npx playwright install chromium\n");
    if (devServer) devServer.kill();
    throw err;
  }

  try {
    for (const theme of THEMES) {
      console.log(`\nCapturing ${theme} theme…`);
      await captureBanner(browser, theme, iconB64, fontB64);
      if (!bannerOnly) await capturePages(browser, theme);
    }
  } finally {
    await browser.close();
    if (devServer) {
      devServer.kill();
      console.log("\nStopped dev server.");
    }
  }

  console.log(`\nDone — images written to ${path.relative(ROOT, OUT_DIR)}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
