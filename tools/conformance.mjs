// Cross-checks this implementation against a build of the reference command-line tool
// on random data, in both directions.
//   REFERENCE=/path/to/base16384 node tools/conformance.mjs [cases]
// SPDX-License-Identifier: Apache-2.0
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { encode, decode, toUTF16BE, readText } from "../src/base16384.mjs";

const ref = process.env.REFERENCE;
if (!ref) {
  console.error("Set REFERENCE to a base16384 executable built from the reference sources.");
  process.exit(2);
}
const run = (args, input) => execFileSync(ref, [...args, "-", "-"], { input, maxBuffer: 1 << 30 });
const SINGLE_BUFFER = 60000; // below the reference tool's read buffer, its output is exact

const count = Number(process.argv[2] || 400);
const sizes = [];
for (let n = 0; n <= 200; n++) sizes.push(n);
while (sizes.length < count) sizes.push(Math.floor(Math.random() ** 3 * 3_000_000));

let failed = 0;
const check = (ok, what, n) => { if (!ok) { failed++; console.log(`FAIL ${what} (n=${n})`); } };
for (const n of sizes) {
  const x = randomBytes(n);
  const ours = encode(x);
  const theirs = run(["-e"], x);
  if (n < SINGLE_BUFFER) check(Buffer.from(toUTF16BE(ours)).equals(theirs), "identical encoding", n);
  check(Buffer.from(decode(readText(theirs).text)).equals(x), "we decode theirs", n);
  check(run(["-d"], Buffer.from(toUTF16BE(ours))).equals(x), "they decode ours", n);
  check(run(["-d"], Buffer.from(toUTF16BE(ours, { bom: false }))).equals(x), "they decode ours without BOM", n);
}
console.log(`${sizes.length} sizes (up to ${Math.max(...sizes).toLocaleString()} bytes): ${failed ? failed + " failures" : "all conform"}`);
process.exit(failed ? 1 : 0);
