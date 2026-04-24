/**
 * build-frontend.js
 * -----------------
 * Builds the Vite frontend and copies the output (dist/) into
 * Jk_backend/dist/ so Express can serve it directly.
 *
 * Works cross-platform (Windows dev machine + Linux Hostinger).
 * Run via:  npm run build   (inside Jk_backend/)
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Paths ──────────────────────────────────────────────────────────────────
const FRONTEND_DIR = path.join(__dirname, "..", "jk_frontend");
const FRONTEND_DIST = path.join(FRONTEND_DIR, "dist");
const BACKEND_DIST = path.join(__dirname, "dist");

// ── Helpers ────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`\n✅ ${msg}`);
}

function error(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

/** Recursively copy a directory (works without shell cp/xcopy) */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Delete a directory recursively (built-in, no rimraf needed) */
function removeDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

console.log("=".repeat(60));
console.log("  JK Executive — Frontend Build + Copy Script");
console.log("=".repeat(60));

// 1. Verify frontend directory exists
if (!fs.existsSync(FRONTEND_DIR)) {
  error(`Frontend directory not found at: ${FRONTEND_DIR}`);
}

// 2. Install frontend dependencies if node_modules missing
const frontendModules = path.join(FRONTEND_DIR, "node_modules");
if (!fs.existsSync(frontendModules)) {
  log("Installing frontend dependencies...");
  execSync("npm install", { cwd: FRONTEND_DIR, stdio: "inherit" });
}

// 3. Build the Vite frontend
log("Building Vite frontend (npm run build)...");
try {
  execSync("npm run build", { cwd: FRONTEND_DIR, stdio: "inherit" });
} catch (e) {
  error("Frontend build failed. Check errors above.");
}

// 4. Verify build output exists
if (!fs.existsSync(FRONTEND_DIST)) {
  error(`Build output not found at: ${FRONTEND_DIST}`);
}

// 5. Clear old backend dist/ and copy fresh build
log("Clearing old Jk_backend/dist/...");
removeDir(BACKEND_DIST);

log("Copying frontend dist/ → Jk_backend/dist/...");
copyDir(FRONTEND_DIST, BACKEND_DIST);

// 6. Verify index.html exists in backend dist
const indexPath = path.join(BACKEND_DIST, "index.html");
if (!fs.existsSync(indexPath)) {
  error("index.html not found in Jk_backend/dist/ — something went wrong.");
}

console.log("\n" + "=".repeat(60));
console.log("  ✅ Build complete! Jk_backend/dist/ is ready.");
console.log("  Run: npm start   →   node server.js");
console.log("=".repeat(60) + "\n");
