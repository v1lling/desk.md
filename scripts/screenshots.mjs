/**
 * Regenerate the README header banner and app screenshots.
 *
 * One command — `npm run screenshots` — produces a consistent set of light and
 * dark images in `assets/`, so the README never shows a stale UI.
 *
 * How it works:
 *  - Runs the app in browser fixture mode (`npm run dev`, port 3001). If a dev
 *    server is already up it is reused; otherwise one is started and stopped.
 *  - Seeds localStorage so onboarding is skipped and the theme + workspace are
 *    deterministic, then screenshots each page in light and dark.
 *  - Records a compact animated README tour by clicking through the real app
 *    navigation: Dashboard, Planner, Tasks, Docs, Meetings, then a project.
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
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "assets");
const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

// Logical viewport; deviceScaleFactor 2 gives crisp retina PNGs.
// Width is sized so the three default Kanban columns sit snug with no dead
// space: sidebar 224 + handle 4 + main px-4 (32) + 3×280 columns + 2×12 gaps.
const VIEWPORT = { width: 1128, height: 760 };
const THEMES = /** @type {const} */ (["light", "dark"]);
const TOUR_WIDTH = 1200;

async function openScreenshotDoc(page) {
  await page
    .getByRole("treeitem", { name: /website redesign/i })
    .click({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await page
    .getByRole("treeitem", { name: "Content Inventory", exact: true })
    .click({ timeout: 10_000 });
  await page.waitForTimeout(700);
}

async function openScreenshotMeeting(page) {
  await page
    .getByText("Client Kickoff", { exact: true })
    .click({ timeout: 10_000 });
  await page.waitForTimeout(700);
}

/**
 * Pages to capture. `route` is opened directly; `?open=` deep-links a tab.
 * `prep` runs extra interaction (the Docs page needs an item opened).
 */
const PAGES = [
  { name: "dashboard", route: "/" },
  { name: "tasks", route: "/tasks" },
  { name: "planner", route: "/planner" },
  { name: "projects", route: "/projects?open=website-redesign" },
  { name: "meetings", route: "/meetings?open=client-kickoff" },
  {
    name: "docs",
    route: "/docs",
    // The Docs page main pane is empty until a document is opened.
    prep: openScreenshotDoc,
  },
];

/**
 * One continuous tour through the real sidebar. Each destination is reached by
 * clicking the app UI, rather than loading six unrelated routes, so the result
 * reads like a small product demo. A short pointer frame makes each click clear.
 */
const TOUR_STEPS = [
  { name: "Dashboard", route: "/" },
  { name: "Planner", route: "/planner" },
  { name: "Tasks", route: "/tasks" },
  { name: "Docs", route: "/docs", prep: openScreenshotDoc },
  { name: "Meetings", route: "/meetings", prep: openScreenshotMeeting },
  { name: "Website Redesign", route: "/projects" },
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

function localISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** A representative current-week plan so the README shows the planner in use. */
function screenshotPlannerState() {
  const monday = new Date();
  const mondayOffset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - mondayOffset);
  const weekOf = localISODate(monday);
  const day = (offset) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + offset);
    return localISODate(date);
  };

  return {
    weekPlans: {
      [weekOf]: {
        weekOf,
        intentions: ["Ship the website refresh", "Prepare the migration dry run"],
        days: {
          [day(0)]: [
            {
              id: "shot-website",
              workspaceId: "acme",
              notes: ["Website launch"],
              taskIds: ["contact-form-endpoint", "analytics-events"],
              startMinute: 540,
              endMinute: 690,
            },
          ],
          [day(1)]: [
            {
              id: "shot-migration",
              workspaceId: "acme",
              notes: ["Migration dry run"],
              taskIds: ["transformation-logic", "id-migration-script"],
              startMinute: 600,
              endMinute: 750,
            },
          ],
          [day(2)]: [
            {
              id: "shot-side-project",
              workspaceId: "side-projects",
              notes: ["Pixel Weather"],
              taskIds: ["location-search"],
              startMinute: 570,
              endMinute: 690,
            },
          ],
          [day(3)]: [
            {
              id: "shot-admin",
              workspaceId: "personal",
              notes: ["Admin afternoon"],
              taskIds: ["quarterly-taxes"],
              startMinute: 780,
              endMinute: 900,
            },
          ],
        },
      },
    },
  };
}

/** localStorage seed so the app boots straight into a deterministic state. */
function seedScript(theme) {
  const boot = { state: { dataPath: "~/DeskMD", setupCompleted: true }, version: 0 };
  const navigation = { state: { currentWorkspaceId: "acme" }, version: 0 };
  const planner = screenshotPlannerState();
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
    localStorage.setItem("planner-store", ${JSON.stringify(JSON.stringify(planner))});
  `;
}

/** Wait until the app shell has hydrated and fixture data is showing. */
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
        <div class="tag">Personal work management in plain Markdown</div>
        <div class="feat">desktop · self-hosted · agent-ready</div>
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
function frameHtml(pngB64, w, h, pad, theme) {
  // 1px ring against the GitHub page background so the framed window has a
  // visible edge on both light and dark themes. Pure-black drop shadows
  // disappear against dark GitHub; the ring carries the separation work there.
  const ring =
    theme === "dark"
      ? "0 0 0 1px rgba(255, 255, 255, 0.30)"
      : "0 0 0 1px rgba(0, 0, 0, 0.08)";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { margin: 0; box-sizing: border-box; }
    html, body { width: ${w + pad * 2}px; height: ${h + pad * 2}px; background: transparent; }
    body { display: flex; align-items: center; justify-content: center; }
    .window {
      position: relative; width: ${w}px; height: ${h}px;
      border-radius: 20px; overflow: hidden;
      box-shadow: ${ring}, 0 24px 70px -16px rgba(0,0,0,0.35), 0 8px 24px -8px rgba(0,0,0,0.22);
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
async function frameWindow(browser, rawBuffer, outPath, theme) {
  const w = VIEWPORT.width * 2; // raw image is captured at deviceScaleFactor 2
  const h = VIEWPORT.height * 2;
  const pad = 110; // transparent margin for the drop shadow
  const context = await browser.newContext({
    viewport: { width: w + pad * 2, height: h + pad * 2 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.setContent(frameHtml(rawBuffer.toString("base64"), w, h, pad, theme), {
    waitUntil: "load",
  });
  const framed = await page.screenshot({ path: outPath, omitBackground: true });
  await context.close();
  return framed;
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
    await frameWindow(browser, raw, path.join(OUT_DIR, `${shot.name}-${theme}.png`), theme);
    console.log(`  ✓ ${shot.name}-${theme}.png`);
  }
}

// ── Animated product tour ──────────────────────────────────────────────────

/** Draw a visible mouse pointer over a sidebar destination for one short frame. */
async function showTourPointer(page, locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Could not locate a sidebar destination for the tour.");
  await page.evaluate(({ x, y }) => {
    document.querySelector("#readme-tour-pointer")?.remove();
    const pointer = document.createElement("div");
    pointer.id = "readme-tour-pointer";
    pointer.style.cssText = `
      position: fixed; left: ${x}px; top: ${y}px; z-index: 2147483647;
      width: 32px; height: 32px; pointer-events: none;
      filter: drop-shadow(0 1px 1px rgba(0,0,0,.4));
    `;
    pointer.innerHTML = `
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="rgba(59,130,246,.20)" stroke="rgba(59,130,246,.75)" stroke-width="2"/>
        <path d="M8 5.5v18l4.5-4.2 3.4 7 3.7-1.8-3.4-6.8H23z" fill="white" stroke="#18181b" stroke-width="1.4" stroke-linejoin="round"/>
      </svg>`;
    document.body.append(pointer);
  }, { x: box.x + box.width * 0.62, y: box.y + box.height * 0.35 });
}

async function hideTourPointer(page) {
  await page.evaluate(() => document.querySelector("#readme-tour-pointer")?.remove());
}

/** Turn equally sized framed PNG buffers into a compact animated WebP. */
async function writeAnimatedTour(frames, outPath) {
  const resized = await Promise.all(
    frames.map(({ image }) => sharp(image).resize({ width: TOUR_WIDTH }).png().toBuffer()),
  );
  const { width, height } = await sharp(resized[0]).metadata();
  if (!width || !height) throw new Error("Could not determine tour frame dimensions.");

  await sharp({
    create: {
      width,
      height: height * resized.length,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      pageHeight: height,
    },
  })
    .composite(resized.map((input, index) => ({ input, left: 0, top: index * height })))
    .webp({
      quality: 82,
      alphaQuality: 90,
      effort: 6,
      loop: 0,
      delay: frames.map(({ delay }) => delay),
    })
    .toFile(outPath);
}

async function captureTour(browser, theme) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: theme,
  });
  await context.addInitScript(seedScript(theme));
  const page = await context.newPage();
  const frames = [];

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  frames.push({ image: await page.screenshot(), delay: 1800 });

  for (const step of TOUR_STEPS.slice(1)) {
    // Count badges are part of the accessible link name (for example
    // "Tasks 12"), so anchor the label at the start instead of matching it
    // exactly. `.first()` selects the primary sidebar when a tab has the same
    // title.
    const destination = page
      .getByRole("link", { name: new RegExp(`^${step.name}(?:\\s|$)`, "i") })
      .first();
    await showTourPointer(page, destination);
    frames.push({ image: await page.screenshot(), delay: 350 });
    await hideTourPointer(page);

    await destination.click({ timeout: 10_000 });
    await page.waitForURL((url) => url.pathname === step.route, { timeout: 10_000 });
    await waitForApp(page);
    if (step.prep) await step.prep(page);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    frames.push({ image: await page.screenshot(), delay: 1800 });
  }

  await context.close();

  const framedFrames = [];
  for (const frame of frames) {
    framedFrames.push({
      image: await frameWindow(browser, frame.image, undefined, theme),
      delay: frame.delay,
    });
  }
  await writeAnimatedTour(framedFrames, path.join(OUT_DIR, `tour-${theme}.webp`));
  console.log(`  ✓ tour-${theme}.webp`);
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
      if (!bannerOnly) {
        await capturePages(browser, theme);
        await captureTour(browser, theme);
      }
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
