#!/usr/bin/env node
/**
 * i18n coverage audit.
 *
 *   npm run i18n:audit            report coverage, exit 1 if French has gaps
 *   npm run i18n:audit -- --list  also print every missing string
 *
 * Sweeps src/ for user-facing English (translator calls, data tables, field
 * schemas and calculator templates), then checks each string against the real
 * translator and catalogs, loaded through Vite so TypeScript resolves exactly
 * as it does in the app. Writes scripts/i18n-report.json with the strings
 * still pending per language, for translators.
 *
 * French must be complete. Inuktitut and Anishinaabemowin are drafts that
 * cover interface text; their pending lists are the hand-off for fluent
 * speakers.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const listAll = process.argv.includes("--list");

/** Literals that are never shown to people (identifiers, protocol values, units of code). */
const IGNORE = new Set([
  "Username-Password-Authentication",
  "Authentication request failed",
  "AbortError",
  "America/Toronto",
  "Mozilla/5.0 (compatible; CivicOS/1.0)",
  "CivicOS",
  "ElevenLabs",
  "Command K",
  "Control K",
  "Ctrl K",
  // Keyboard key names compared in handlers
  "Tab",
  "Enter",
  "Escape",
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  // Code values, font names, headers and media queries
  "Segoe UI",
  "Content-Type",
  "(prefers-reduced-motion: reduce)",
  "width=device-width, initial-scale=1",
  // Internal errors replaced by user-facing messages before display
  "Traffic feed X1",
  "Feed X1",
  "News X1",
  "Alerts X1",
  "Aabitoose",
  "text/html;charset=utf-8",
  "Likely eligible — ",
  "Coverage: ",
  "&amp;",
  "&lt;",
  "&gt;",
  "Aborted",
  "Unknown neighbourhood: X1",
  "X1, Ottawa, Ontario",
  "GCD,C_ZONE,SCHEDULE,CONTRACTOR",
]);


const SKIP_DIRS = new Set(["catalogs"]);
const SKIP_FILES = new Set(["vite-env.d.ts"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(path, out);
    } else if (/\.(jsx?|tsx?)$/.test(name) && !SKIP_FILES.has(name)) out.push(path);
  }
  return out;
}

const unescape = (s) => s.replace(/\\(["'`\\])/g, "$1").replace(/\\n/g, "\n");

/** Strings passed to t()/tp()/Tx text or declared in display tables. */
function extract(code) {
  const found = [];
  const translatorCall = /\b(?:t|tp)\(\s*"((?:[^"\\]|\\.)*)"(?:\s*,\s*"((?:[^"\\]|\\.)*)")?/g;
  for (const m of code.matchAll(translatorCall)) {
    found.push({ text: unescape(m[1]), explicit: true });
    if (m[2]) found.push({ text: unescape(m[2]), explicit: true });
  }
  const stripped = code
    .split("\n")
    .filter((line) => !/^\s*(import|export \{|\/\/|\*|\/\*)/.test(line) && !/className=|console\./.test(line))
    .join("\n");
  for (const m of stripped.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) found.push({ text: unescape(m[1]), explicit: false });
  // Template literals become patterns: ${expr} -> sample tokens.
  for (const m of stripped.matchAll(/`((?:[^`\\]|\\.)*)`/g)) {
    if (!m[1].includes("${")) {
      found.push({ text: unescape(m[1]), explicit: false });
      continue;
    }
    let n = 0;
    const sample = m[1].replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, () => `X${++n}`);
    found.push({ text: unescape(sample), explicit: false, template: true });
  }
  return found;
}

/** Heuristic: does a non-translator literal look like text a person reads? */
function looksLikeCopy(text) {
  if (IGNORE.has(text)) return false;
  if (!/[A-Za-z]{2,}/.test(text)) return false;
  if (text.includes("${")) return false; // template text inside a plain string
  if (/^[.[]/.test(text)) return false; // CSS selectors
  if (/^https?:|^mailto:|^tel:|^\/|^\.\.?\/|^#|\.(svg|png|json|css|html)$/.test(text)) return false;
  if (/:not\(|\[\w+\]|^[a-z]{2}(-[A-Z]{2})?( [a-z]{2}(-[A-Z]{2})?)*$/.test(text)) return false; // selectors, locale lists
  if (!/\s/.test(text) && /X\d/.test(text)) return false; // template keys like `wizard-${id}`
  if (/--|__|=>|\bvar\(|[{}<>]/.test(text) && !/\{\w+\}/.test(text)) return false;
  if (/^[a-z0-9_$.:/#@?&=%+ -]+$/.test(text) && !/[A-Z]/.test(text)) return false; // identifiers, classes, keywords
  if (/^[A-Z0-9_]+$/.test(text)) return false; // CONSTANTS, codes
  if (/^[A-Z][a-z]+[A-Z]\w*$/.test(text)) return false; // PascalCase identifiers
  if (/^[a-z][a-z0-9]*[A-Z]\w*$/.test(text)) return false; // camelCase identifiers
  if (/^[A-Z][a-z']+(-[a-z']+)+$/.test(text) && /giizh|giizis|Aabitoose/.test(text)) return false; // Anishinaabemowin calendar names
  if (/^X\d+$/.test(text.trim())) return false;
  return true;
}

const server = await createServer({
  root,
  configFile: false,
  // Separate cache so the audit never invalidates a running dev server's optimized deps.
  cacheDir: "node_modules/.vite-i18n-audit",
  optimizeDeps: { noDiscovery: true, include: [] },
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
});

try {
  const { createTranslator } = await server.ssrLoadModule("/src/i18n/translator.ts");
  const catalogs = {
    fr: (await server.ssrLoadModule("/src/i18n/catalogs/fr/index.ts")).default,
    iu: (await server.ssrLoadModule("/src/i18n/catalogs/iu.ts")).default,
    oj: (await server.ssrLoadModule("/src/i18n/catalogs/oj.ts")).default,
  };
  const translators = Object.fromEntries(
    Object.entries(catalogs).map(([locale, catalog]) => [locale, createTranslator(locale, catalog, locale === "fr" ? "fr-CA" : "en-CA")]),
  );

  const strings = new Map();
  for (const file of walk(src)) {
    const rel = relative(root, file).replace(/\\/g, "/");
    for (const item of extract(readFileSync(file, "utf8"))) {
      if (!item.explicit && !looksLikeCopy(item.text)) continue;
      if (!item.text.trim()) continue;
      const entry = strings.get(item.text) ?? { files: new Set(), template: item.template ?? false };
      entry.files.add(rel);
      strings.set(item.text, entry);
    }
  }

  const report = {};
  for (const [locale, translator] of Object.entries(translators)) {
    const missing = [...strings.entries()].filter(([text]) => !translator.has(text)).map(([text, e]) => ({ text, files: [...e.files], template: e.template }));
    report[locale] = { total: strings.size, translated: strings.size - missing.length, missing };
  }

  writeFileSync(
    join(root, "scripts", "i18n-report.json"),
    JSON.stringify(
      Object.fromEntries(Object.entries(report).map(([l, r]) => [l, { total: r.total, translated: r.translated, pending: r.missing.map((m) => m.text) }])),
      null,
      2,
    ),
  );

  for (const [locale, r] of Object.entries(report)) {
    const pct = ((r.translated / r.total) * 100).toFixed(1);
    console.log(`${locale}: ${r.translated}/${r.total} strings (${pct}%)${locale === "fr" ? "" : "  draft: interface text only"}`);
  }
  const fr = report.fr.missing;
  if (fr.length && (listAll || fr.length <= 400)) {
    console.log(`\nFrench strings still missing (${fr.length}):`);
    for (const m of fr) console.log(`  ${JSON.stringify(m.text)}  <- ${m.files.join(", ")}${m.template ? " (template)" : ""}`);
  }
  if (listAll) {
    for (const locale of ["iu", "oj"]) console.log(`\n${locale} pending: ${report[locale].missing.length} (see scripts/i18n-report.json)`);
  }
  process.exitCode = fr.length ? 1 : 0;
} finally {
  await server.close();
}
