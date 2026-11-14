// Throughput of encode/decode, next to the runtime's built-in base64 and hex.
//   node tools/bench.mjs            print a table
//   node tools/bench.mjs --svg      also draw images/bench.svg
// Numbers depend on the machine; compare rows, not absolute values.
// SPDX-License-Identifier: Apache-2.0
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { encode, decode } from "../src/base16384.mjs";

const SIZES = [1 << 10, 1 << 16, 1 << 20, 1 << 24];
const label = (n) => (n >= 1 << 20 ? `${n >> 20} MiB` : `${n >> 10} KiB`);

function rate(fn, bytes) {
  fn(); // warm up
  let runs = 0;
  const start = performance.now();
  let t = 0;
  while ((t = performance.now() - start) < 400 || runs < 3) { fn(); runs++; }
  return (bytes * runs) / (t / 1000) / 1e6; // MB/s of binary data
}

const rows = [];
for (const n of SIZES) {
  const x = new Uint8Array(randomBytes(n));
  const buf = Buffer.from(x);
  const k = encode(x), b64 = buf.toString("base64"), hx = buf.toString("hex");
  rows.push({
    size: label(n),
    "base16384 encode": rate(() => encode(x), n),
    "base16384 decode": rate(() => decode(k), n),
    "base64 encode": rate(() => buf.toString("base64"), n),
    "base64 decode": rate(() => Buffer.from(b64, "base64"), n),
    "hex encode": rate(() => buf.toString("hex"), n),
    "hex decode": rate(() => Buffer.from(hx, "hex"), n),
  });
}

const env = `JavaScript runtime ${process.version}, ${process.arch}`;
console.log(`MB/s of binary data, ${env}`);
console.table(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? Math.round(v) : v]))));

if (process.argv.includes("--svg")) {
  // Grouped bars for the 1 MiB row: the representative size.
  const r = rows.find((x) => x.size === "1 MiB");
  const series = [["encode", ["base16384 encode", "base64 encode", "hex encode"]], ["decode", ["base16384 decode", "base64 decode", "hex decode"]]];
  const max = Math.max(...series.flatMap(([, ks]) => ks.map((k) => r[k])));
  const W = 760, H = 350, X = 150, BW = 520, row = 30;
  const ink = "#1b1d21", mute = "#5d636c", line = "#d4d7dc", accent = "#b0402f", alt = "#7b8794";
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif" role="img" aria-label="Throughput at 1 MiB: base16384 compared with base64 and hex">`,
    `<rect width="${W}" height="${H}" rx="8" fill="#f7f6f3"/>`,
    `<text x="24" y="34" font-size="15" fill="${ink}">Throughput at 1 MiB (MB/s of binary data)</text>`,
    `<text x="24" y="54" font-size="11" fill="${mute}">${env}. base64 and hex are the runtime’s native built-ins; this library is plain JavaScript.</text>`];
  let y = 80;
  for (const [group, keys] of series) {
    out.push(`<text x="24" y="${y + 14}" font-size="11" letter-spacing="1.5" fill="${mute}">${group.toUpperCase()}</text>`);
    y += 22;
    for (const k of keys) {
      const w = Math.max(2, (r[k] / max) * BW);
      const name = k.split(" ")[0];
      out.push(`<text x="${X - 10}" y="${y + 17}" text-anchor="end" font-size="12" fill="${ink}">${name}</text>`);
      out.push(`<rect x="${X}" y="${y + 4}" width="${w.toFixed(1)}" height="18" rx="2" fill="${name === "base16384" ? accent : alt}"/>`);
      out.push(`<text x="${X + w + 6}" y="${y + 17}" font-size="12" fill="${ink}">${Math.round(r[k]).toLocaleString("en")}</text>`);
      y += row;
    }
    y += 12;
  }
  out.push(`<line x1="${X}" y1="74" x2="${X}" y2="${y - 6}" stroke="${line}"/>`, "</svg>");
  writeFileSync(new URL("../images/bench.svg", import.meta.url), out.join("\n") + "\n");
  console.log("images/bench.svg written");
}
