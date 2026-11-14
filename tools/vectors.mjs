// Regenerates test/vectors.json from a build of the reference command-line tool.
//   REFERENCE=/path/to/base16384 node tools/vectors.mjs
// The reference is only executed; nothing from it is copied into this project.
// SPDX-License-Identifier: Apache-2.0
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const ref = process.env.REFERENCE;
if (!ref) {
  console.error("Set REFERENCE to a base16384 executable built from the reference sources.");
  process.exit(2);
}
const run = (args, input) => execFileSync(ref, [...args, "-", "-"], { input });
const help = spawnSync(ref, ["-h"], { encoding: "utf8" });
const version = (help.stdout + help.stderr).match(/\d+\.\d+\.\d+/)?.[0] ?? "unknown";

// Deterministic inputs: every length 0–30 and a few shapes, all well under the reference
// tool's read buffer so its padding bits are zero (see FORMAT.md).
const prng = (seed) => () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) >>> 24);
const inputs = [];
for (let n = 0; n <= 30; n++) { const r = prng(n + 1); inputs.push(Uint8Array.from({ length: n }, r)); }
inputs.push(
  new TextEncoder().encode("1234567"), new TextEncoder().encode("12345678"),
  new TextEncoder().encode("Hello, world!"), new TextEncoder().encode("漢字とかな"),
  new Uint8Array(14), new Uint8Array(14).fill(255), Uint8Array.from({ length: 256 }, (_, i) => i),
);

const vectors = inputs.map((b) => {
  const units = run(["-en"], b);
  let text = "";
  for (let i = 0; i < units.length; i += 2) text += String.fromCharCode((units[i] << 8) | units[i + 1]);
  return { hex: Buffer.from(b).toString("hex"), text };
});
writeFileSync(
  new URL("../test/vectors.json", import.meta.url),
  JSON.stringify({ source: `reference command-line tool ${version}, run with -en`, vectors }, null, 1) + "\n",
);
console.log(`test/vectors.json: ${vectors.length} vectors from reference ${version}`);
