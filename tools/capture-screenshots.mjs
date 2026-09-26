#!/usr/bin/env node
// Captures the website screenshots from a built Word Hunter frontend.
//
//   node tools/capture-screenshots.mjs <path-to-WordHunter-checkout>
//
// Run `npm ci && npm run build:frontend` in the Word Hunter checkout first.
// The app runs as a plain web page (no desktop bridge) with a seeded German
// profile, so every capture shows the current interface with the same data.
import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = createRequire(join(process.execPath, "..", "..", "lib", "node_modules", "/"))("playwright");
}

const appRoot = resolve(process.argv[2] || "../WordHunter");
const webRoot = join(appRoot, "dist", "web");
const outDir = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

const server = createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const file = join(webRoot, path === "/" ? "index.html" : path);
  try {
    if (!file.startsWith(webRoot) || !(await stat(file)).isFile()) throw new Error("not found");
    response.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const base = `http://127.0.0.1:${server.address().port}/index.html`;

// Deterministic demo vocabulary: words from the German starter stories with a
// spread of statuses, review dates and scheduling state.
function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const WORDS = [
  ["Zimmer", "room", "das"], ["Fluss", "river", "der"], ["Bahnhof", "railway station", "der"],
  ["Marktplatz", "market square", "der"], ["Anfang", "beginning", "der"], ["Stock", "floor, storey", "der"],
  ["freundlich", "friendly"], ["Fenster", "window", "das"], ["Schrank", "wardrobe", "der"],
  ["Wand", "wall", "die"], ["Decke", "blanket", "die"], ["Umzugswagen", "removal van", "der"],
  ["schwer", "heavy"], ["Kiste", "box, crate", "die"], ["leicht", "light"], ["Tasse", "cup", "die"],
  ["Wasserkocher", "kettle", "der"], ["plötzlich", "suddenly"], ["klingeln", "to ring"],
  ["lockig", "curly"], ["Brot", "bread", "das"], ["riechen", "to smell"], ["Bäckerei", "bakery", "die"],
  ["gebacken", "baked"], ["außerdem", "besides"], ["sauber", "clean"], ["erzählen", "to tell"],
  ["ruhig", "quiet, calm"], ["Erdgeschoss", "ground floor", "das"], ["Tochter", "daughter", "die"],
  ["sich kümmern", "to take care of"], ["Bewohner", "resident", "der"], ["Regal", "shelf", "das"],
  ["Anleitung", "instructions", "die"], ["Schraube", "screw", "die"], ["Brett", "board", "das"],
  ["fehlen", "to be missing"], ["müde", "tired"], ["klopfen", "to knock"], ["Werkzeug", "tools", "das"],
  ["prüfen", "to check"], ["gemeinsam", "together"], ["messen", "to measure"], ["Schild", "sign", "das"],
  ["Abschied", "farewell", "der"], ["vermissen", "to miss"], ["Geräusch", "sound, noise", "das"],
  ["fremd", "unfamiliar"], ["Pflaster", "cobblestones", "das"], ["Heimatdorf", "home village", "das"],
];

function isoDate(daysAgo) {
  const date = new Date(Date.UTC(2026, 8, 25) - daysAgo * 86400000);
  return date.toISOString().slice(0, 10);
}

function demoVocab(storyText) {
  const random = seededRandom(20260925);
  const vocab = {};
  const sentences = storyText.split(/\n+/).flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .filter((sentence) => sentence.length > 30);
  WORDS.forEach(([word, translation, article], index) => {
    const example = sentences.find((sentence) => sentence.includes(word.split(" ").pop()));
    const roll = random();
    const status = index < 6 ? "learning" : roll < 0.55 ? "learning" : roll < 0.85 ? "known" : "new";
    const added = 5 + Math.floor(random() * 80);
    const reviewed = Math.max(0, added - 1 - Math.floor(random() * added));
    const interval = status === "known" ? 21 + Math.floor(random() * 40) : 1 + Math.floor(random() * 12);
    const due = index < 6 ? -1 : Math.floor(random() * 14) - 2;
    vocab[word.toLowerCase()] = {
      word,
      status,
      article: article || "",
      translation,
      examples: example ? [example.trim()] : [],
      interval,
      repetition: status === "new" ? 0 : 1 + Math.floor(random() * 6),
      efactor: 2.2 + random() * 0.6,
      stability: interval * (0.8 + random() * 0.6),
      difficulty: 3 + random() * 4,
      srsAlgorithm: "fsrs",
      nextDate: isoDate(-due),
      addedAt: `${isoDate(added)}T18:00:00.000Z`,
      lastReviewedAt: status === "new" ? undefined : `${isoDate(reviewed)}T19:30:00.000Z`,
    };
  });
  // Most words of the opening chapter are already known, a share is being
  // learned and the rest stays new, like a learner a few weeks in.
  const chapter = storyText.slice(storyText.indexOf("Lea ist"), storyText.search(/\n\s*2\./));
  const tokens = chapter.match(/\p{L}+/gu) || [];
  for (const token of new Set(tokens.map((word) => word.toLowerCase()))) {
    if (vocab[token]) continue;
    const roll = random();
    if (roll > 0.95) continue;
    const learning = roll > 0.83;
    const added = 10 + Math.floor(random() * 80);
    vocab[token] = {
      word: token,
      status: learning ? "learning" : "known",
      translation: "",
      examples: [],
      interval: learning ? 1 + Math.floor(random() * 8) : 30 + Math.floor(random() * 60),
      repetition: learning ? 1 + Math.floor(random() * 3) : 4 + Math.floor(random() * 5),
      efactor: 2.3 + random() * 0.4,
      stability: learning ? 2 + random() * 6 : 30 + random() * 60,
      difficulty: 3 + random() * 4,
      srsAlgorithm: "fsrs",
      nextDate: isoDate(-(3 + Math.floor(random() * 40))),
      addedAt: `${isoDate(added)}T18:00:00.000Z`,
      lastReviewedAt: `${isoDate(Math.floor(random() * added))}T19:30:00.000Z`,
    };
  }
  return vocab;
}

const storyText = await readFile(join(webRoot, "books", "starter", "de-stories.txt"), "utf8");

function seedState(view, extra = {}) {
  const vocab = demoVocab(storyText);
  return {
    schemaVersion: 2,
    currentView: view,
    currentTextId: view === "reader" ? "starter-de-common-stories" : null,
    filters: { vocabStatuses: ["learning"], vocabQuery: "", vocabTextId: "all" },
    selectedWord: view === "reader" ? "zimmer" : null,
    preferences: {
      locale: "en",
      learningLanguage: "de",
      languageOnboardingDone: true,
      theme: "familiar",
      useEdgeTts: false,
      autoTtsOnFlashcardOpen: false,
      autoTtsOnWordFocus: false,
      disableUpdateCheck: true,
      reviewUpcomingVisible: false,
      ...extra,
    },
    profiles: { de: { vocab, customTexts: [], userBooks: [], hiddenBuiltInBooks: [], archivedBookIds: [], preferences: {} } },
    vocab,
  };
}

const SHOTS = [
  { name: "pc-library", view: "library" },
  { name: "pc-reader", view: "reader" },
  { name: "pc-flashcards", view: "flashcards" },
  { name: "pc-word-base", view: "vocabulary" },
  { name: "pc-graphs", view: "graphs" },
  { name: "pocket-library", view: "library", pocket: true },
  { name: "pocket-reader", view: "reader", pocket: true },
  { name: "pocket-flashcards", view: "flashcards", pocket: true },
  { name: "pocket-graphs", view: "graphs", pocket: true },
];

// Screenshots are published as WebP, encoded by Chromium itself so the script
// needs nothing beyond Playwright.
async function toWebp(browser, png) {
  const page = await browser.newPage();
  try {
    const dataUrl = await page.evaluate(async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext("2d").drawImage(image, 0, 0);
      return canvas.toDataURL("image/webp", 0.9);
    }, `data:image/png;base64,${png.toString("base64")}`);
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  } finally {
    await page.close();
  }
}

// The link preview image (og:image): name, tagline and the reader screenshot.
async function captureSocialCard(browser) {
  const reader = await readFile(join(outDir, "pc-reader.webp"));
  const logo = await readFile(fileURLToPath(new URL("../src/web/favicon.svg", import.meta.url)));
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(`<!doctype html><html><body style="margin:0;width:1200px;height:630px;overflow:hidden;
    font-family:system-ui,sans-serif;color:#e6eff6;background:radial-gradient(700px 500px at 90% 0%,#0a4f80,transparent 70%),#081520">
    <div style="position:absolute;left:72px;top:88px;width:470px">
      <div style="display:flex;align-items:center;gap:16px;font-size:34px;font-weight:750">
        <img src="data:image/svg+xml;base64,${logo.toString("base64")}" width="56" height="56">Word Hunter</div>
      <div style="margin-top:48px;font-size:58px;font-weight:800;line-height:1.05;letter-spacing:-0.03em">
        Learn languages by reading what you <span style="box-shadow:inset 0 -0.2em 0 #f3c73e">love</span>.</div>
      <div style="margin-top:28px;font-size:25px;line-height:1.4;color:#9bb0c0">Free reader and vocabulary trainer for Windows, macOS, Linux and Android.</div>
    </div>
    <img src="data:image/webp;base64,${reader.toString("base64")}" style="position:absolute;left:600px;top:92px;width:760px;
      border-radius:14px;border:1px solid #1f374a;box-shadow:0 30px 70px -20px #000">
  </body></html>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: fileURLToPath(new URL("../docs/og-image.png", import.meta.url)) });
  await page.close();
  console.log("captured og-image");
}

const browser = await playwright.chromium.launch();
try {
  for (const shot of SHOTS) {
    const page = await browser.newPage(shot.pocket
      ? { viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    // The desktop app keeps the default theme dark; match it on the phone.
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.addInitScript((state) => {
      localStorage.setItem("wordHunterStateV2", state);
      // Show the import panel as the desktop packages do (local OCR bundled).
      window.WH_IMAGE_OCR_AVAILABLE = true;
    }, JSON.stringify(seedState(shot.view)));
    await page.goto(shot.pocket ? `${base}?platform=android` : base, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !document.documentElement.classList.contains("app-booting"));
    await page.waitForTimeout(1500);
    await writeFile(join(outDir, `${shot.name}.webp`), await toWebp(browser, await page.screenshot()));
    await page.close();
    console.log(`captured ${shot.name}`);
  }
  await captureSocialCard(browser);
} finally {
  await browser.close();
  server.close();
}
