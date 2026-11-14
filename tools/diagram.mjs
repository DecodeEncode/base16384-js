// Draws images/format.svg from the implementation: "12345678" → 婌焳廔萷尀㴁.
// SPDX-License-Identifier: Apache-2.0
import { writeFileSync } from "node:fs";
import { encodeText } from "../src/base16384.mjs";

const word = "12345678";
const bytes = [...new TextEncoder().encode(word)];
const out = encodeText(word);
const bits = bytes.slice(0, 7).map((b) => b.toString(2).padStart(8, "0")).join("");

const W = 820, H = 380, X = 64, B = 12; // bit width
const paper = "#f7f6f3", ink = "#1b1d21", mute = "#5d636c", line = "#d4d7dc", accent = "#b0402f", band = "#ecebe7";
const s = [];
const t = (x, y, str, o = {}) =>
  s.push(`<text x="${x}" y="${y}" font-size="${o.size ?? 12}" fill="${o.fill ?? ink}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.mono ? ' font-family="monospace"' : ""}${o.ls ? ` letter-spacing="${o.ls}"` : ""}>${str}</text>`);

s.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif" role="img" aria-label="Seven bytes become four characters; a short last group is followed by an end marker">`);
s.push(`<rect width="${W}" height="${H}" rx="8" fill="${paper}"/>`);
t(24, 34, "Seven bytes → 56 bits → four 14-bit values → four characters", { size: 15 });

// bytes 1–7
t(24, 70, "BYTES", { size: 10, fill: mute, ls: 1.5 });
bytes.slice(0, 7).forEach((b, i) => {
  const x = X + 8 + i * 8 * B;
  s.push(`<rect x="${x + 2}" y="78" width="${8 * B - 4}" height="26" rx="3" fill="none" stroke="${ink}" stroke-opacity=".35"/>`);
  t(x + 4 * B, 96, `${b.toString(16)} ‘${word[i]}’`, { anchor: "middle" });
});
// bits
t(24, 128, "BITS", { size: 10, fill: mute, ls: 1.5 });
[...bits].forEach((c, i) => {
  const x = X + 8 + i * B, g = Math.floor(i / 14);
  s.push(`<rect x="${x}" y="134" width="${B}" height="20" fill="${g % 2 ? band : paper}"/>`);
  t(x + B / 2, 148, c, { size: 10, anchor: "middle", mono: true });
});
for (let i = 0; i <= 56; i += 14) s.push(`<line x1="${X + 8 + i * B}" y1="154" x2="${X + 8 + i * B}" y2="166" stroke="${accent}" stroke-width="1.5"/>`);
// values → characters
t(24, 196, "VALUES", { size: 10, fill: mute, ls: 1.5 });
t(24, 246, "CHARS", { size: 10, fill: mute, ls: 1.5 });
for (let k = 0; k < 4; k++) {
  const v = parseInt(bits.slice(k * 14, k * 14 + 14), 2), cx = X + 8 + (k * 14 + 7) * B;
  t(cx, 196, `${v} + 0x4E00`, { anchor: "middle", size: 13 });
  t(cx, 252, out[k], { anchor: "middle", size: 36 });
  t(cx, 274, `U+${out.charCodeAt(k).toString(16).toUpperCase()}`, { anchor: "middle", size: 10, fill: mute, mono: true });
}

// the short tail
s.push(`<line x1="24" y1="300" x2="${W - 24}" y2="300" stroke="${line}"/>`);
t(24, 330, "A last group of 1–6 bytes is padded with zero bits, written in as few characters as it needs,", { size: 12, fill: mute });
t(24, 348, "and followed by an end marker U+3D01–U+3D06 that records its length.", { size: 12, fill: mute });
const tx = 600;
t(tx, 326, `‘8’ → ${out[4]}`, { size: 22 });
t(tx + 86, 326, out[5], { size: 22, fill: accent });
t(tx, 352, `U+${out.charCodeAt(4).toString(16).toUpperCase()}  then  U+${out.charCodeAt(5).toString(16).toUpperCase()} (1 byte)`, { size: 10, fill: mute, mono: true });
s.push("</svg>");

writeFileSync(new URL("../images/format.svg", import.meta.url), s.join("\n") + "\n");
console.log("images/format.svg:", out);
