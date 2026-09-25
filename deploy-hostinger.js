/**
 * deploy-hostinger.js
 * -------------------
 * One-click Hostinger deployment package creator.
 *
 * What it does:
 *  - Packages backend files (dist/, src/, server.js, package.json,
 *    package-lock.json) into a zip at ../app-deployment/app-deployment.zip
 *
 * Pre-requisite:
 *  - Run `npm run build` in jk_frontend/ first so Jk_backend/dist/ is ready.
 *
 * Usage (from inside Jk_backend/):
 *   node deploy-hostinger.js
 *     OR
 *   npm run deploy
 *
 * Then upload app-deployment.zip to Hostinger, extract it, and run:
 *   npm install --production && node server.js  (or use PM2)
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Paths ────────────────────────────────────────────────────────────────────
const BACKEND_DIR  = __dirname;
const BACKEND_DIST = path.join(BACKEND_DIR, "dist");
const OUTPUT_DIR   = path.join(__dirname, "..", "app-deployment");
const ZIP_PATH     = path.join(OUTPUT_DIR, "app-deployment.zip");

// Files / folders to bundle (relative to BACKEND_DIR)
const INCLUDE = [
  "dist",
  "src",
  "server.js",
  "package.json",
  "package-lock.json",
];

// ── Tiny helpers ─────────────────────────────────────────────────────────────
function log(msg)  { console.log(`\n✅  ${msg}`); }
function warn(msg) { console.warn(`\n⚠️   ${msg}`); }
function fail(msg) { console.error(`\n❌  ${msg}`); process.exit(1); }
function sep()     { console.log("─".repeat(60)); }

function removeDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

/** Recursively collect { abs, rel } for every file under absPath */
function gatherFiles(absPath, base, files = []) {
  if (fs.statSync(absPath).isDirectory()) {
    for (const child of fs.readdirSync(absPath))
      gatherFiles(path.join(absPath, child), base, files);
  } else {
    files.push({ abs: absPath, rel: path.relative(base, absPath) });
  }
  return files;
}

// ── Pure-Node ZIP builder (no external deps) ─────────────────────────────────
function u16(n) { const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); return b; }
function u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b; }

function dosDateTime(date) {
  const d = date || new Date();
  return {
    dosDate: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    dosTime: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
  };
}

function crc32(buf) {
  const T = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = T[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files, destPath) {
  const chunks = [];
  const cd = [];
  let offset = 0;

  for (const { abs, rel } of files) {
    const raw  = fs.readFileSync(abs);
    const comp = zlib.deflateRawSync(raw, { level: 6 });
    const useDeflate = comp.length < raw.length;
    const data = useDeflate ? comp : raw;
    const method = useDeflate ? 8 : 0;
    const name = Buffer.from(rel.replace(/\\/g, "/"), "utf8");
    const crc  = crc32(raw);
    const { dosDate, dosTime } = dosDateTime(fs.statSync(abs).mtime);

    const lh = Buffer.concat([
      Buffer.from([0x50,0x4b,0x03,0x04]),
      u16(20), u16(0), u16(method),
      u16(dosTime), u16(dosDate),
      u32(crc), u32(data.length), u32(raw.length),
      u16(name.length), u16(0),
      name,
    ]);
    const cde = Buffer.concat([
      Buffer.from([0x50,0x4b,0x01,0x02]),
      u16(20), u16(20), u16(0), u16(method),
      u16(dosTime), u16(dosDate),
      u32(crc), u32(data.length), u32(raw.length),
      u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset),
      name,
    ]);

    chunks.push(lh, data);
    cd.push(cde);
    offset += lh.length + data.length;
  }

  const cdb  = Buffer.concat(cd);
  const eocd = Buffer.concat([
    Buffer.from([0x50,0x4b,0x05,0x06]),
    u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(cdb.length), u32(offset),
    u16(0),
  ]);

  fs.writeFileSync(destPath, Buffer.concat([...chunks, cdb, eocd]));
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(60));
console.log("  JK Executive — Hostinger Deployment Package Creator");
console.log("=".repeat(60));

// Guard: dist/ must already exist (run `npm run build` in jk_frontend first)
if (!fs.existsSync(path.join(BACKEND_DIST, "index.html"))) {
  fail(
    "Jk_backend/dist/index.html not found.\n\n" +
    "  Build the frontend first, then re-run this script:\n" +
    "    cd ../jk_frontend && npm run build\n"
  );
}

sep();
console.log("Collecting files for deployment ZIP...");
sep();

removeDir(OUTPUT_DIR);
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const allFiles = [];
for (const item of INCLUDE) {
  const abs = path.join(BACKEND_DIR, item);
  if (!fs.existsSync(abs)) { warn(`Skipping (not found): ${item}`); continue; }
  const gathered = gatherFiles(abs, BACKEND_DIR);
  allFiles.push(...gathered);
  log(`${item}  →  ${gathered.length} file(s) collected`);
}

if (allFiles.length === 0) fail("Nothing to zip. Aborting.");

console.log(`\n📦  Zipping ${allFiles.length} total files → ${ZIP_PATH}`);
buildZip(allFiles, ZIP_PATH);

const mb = (fs.statSync(ZIP_PATH).size / 1024 / 1024).toFixed(2);
log(`ZIP created — ${mb} MB`);

console.log("\n" + "=".repeat(60));
console.log("  🚀  DEPLOYMENT PACKAGE READY!");
console.log("=".repeat(60));
console.log(`\n  📁  ${ZIP_PATH}\n`);
console.log("  Hostinger upload steps:");
console.log("  1. Upload app-deployment.zip via File Manager");
console.log("  2. Extract to your Node.js app root");
console.log("  3. Entry point → server.js");
console.log("  4. npm install --production");
console.log("  5. Start app from Hostinger panel");
console.log("\n" + "=".repeat(60) + "\n");
