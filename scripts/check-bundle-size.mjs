import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

// Performance budget for the app's main JS bundle (gzipped), run after
// `vite build`. Guards against regressions like a heavy dependency
// creeping back into eager/main-chunk code - which is exactly what
// happened with leva (see boardDebugControls.tsx / physicsDebugControls.tsx):
// it was dead code in production but still shipped ~67KB gzipped to every
// visitor until it was lazy-loaded. This budget has headroom above the
// current main chunk (~383KB gzipped) so normal growth doesn't trip it,
// but a similar regression will.
const BUDGET_BYTES = 425 * 1024; // 425 KB gzipped

const distAssets = path.join(process.cwd(), "dist", "assets");

let entries;
try {
  entries = readdirSync(distAssets);
} catch {
  console.error(
    `Could not read ${distAssets} - run "vite build" before this check.`,
  );
  process.exit(1);
}

// The main entry chunk is the largest top-level index-*.js file. Lazy
// chunks (boardDebugControls-*.js, physicsDebugControls-*.js,
// debugSaveButton-*.js, ...) are intentionally excluded - they're only
// fetched behind the dev-only "helper" debug flag, never on a normal load.
const mainChunk = entries
  .filter((file) => /^index-.*\.js$/.test(file))
  .map((file) => path.join(distAssets, file))
  .sort((a, b) => statSync(b).size - statSync(a).size)[0];

if (!mainChunk) {
  console.error(`No main entry chunk (index-*.js) found in ${distAssets}.`);
  process.exit(1);
}

const gzipBytes = gzipSync(readFileSync(mainChunk)).length;
const fmt = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

console.log(
  `Main bundle: ${path.basename(mainChunk)} - ${fmt(gzipBytes)} gzipped (budget ${fmt(BUDGET_BYTES)})`,
);

if (gzipBytes > BUDGET_BYTES) {
  console.error(
    `\nBundle size budget exceeded: ${fmt(gzipBytes)} > ${fmt(BUDGET_BYTES)}.\n` +
      "If this growth is expected, either lazy-load the new code/dependency " +
      "(see BoardDebugControls/PhysicsDebugControls for the pattern) or " +
      "raise BUDGET_BYTES in scripts/check-bundle-size.mjs with a note on why.",
  );
  process.exit(1);
}
