// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import * as b from "../src/base16384.mjs";

const { vectors } = JSON.parse(readFileSync(new URL("vectors.json", import.meta.url), "utf8"));
const hex = (h) => Uint8Array.from(Buffer.from(h, "hex"));
const bytes = (s) => new TextEncoder().encode(s);

test("vectors produced by the reference tool", () => {
  assert.ok(vectors.length >= 30);
  for (const v of vectors) {
    assert.equal(b.encode(hex(v.hex)), v.text, v.hex);
    assert.deepEqual(b.decode(v.text), hex(v.hex), v.hex);
  }
});

test("documented examples", () => {
  assert.equal(b.encodeText("1234567"), "婌焳廔萷");
  assert.equal(b.encodeText("12345678"), "婌焳廔萷尀㴁");
  assert.equal(b.decodeText("婌焳廔萷"), "1234567");
  assert.equal(b.encode([]), "");
});

test("length and end marker for every remainder", () => {
  for (let n = 0; n < 50; n++) {
    const s = b.encode(new Uint8Array(n));
    assert.equal(s.length, b.encodedLength(n));
    const last = s.charCodeAt(s.length - 1);
    if (n % 7) assert.equal(last, 0x3d00 + (n % 7));
    else assert.ok(!s || (last >= 0x4e00 && last <= 0x8dff));
  }
});

test("random round trips", () => {
  for (let i = 0; i < 3000; i++) {
    const x = new Uint8Array(randomBytes(i % 211));
    assert.deepEqual(b.decode(b.encode(x)), x);
    assert.deepEqual(b.decode(b.encodeToUnits(x)), x);
  }
});

test("whitespace and a leading byte order mark are ignored", () => {
  const s = b.encodeText("whitespace survives copy and paste");
  const messy = "﻿" + [...s].join(" ").replace(/(.{9})/g, "$1\n") + "　\r\n";
  assert.equal(b.decodeText(messy), "whitespace survives copy and paste");
});

test("strict decoding rejects damage with a position", () => {
  const cases = [
    ["婌焳A廔萷", "foreign", 2],
    ["婌焳廔萷尀", "no-end", -1],
    ["婌焳廔萷尀㴆", "bad-end", 5],
    ["婌焳廔萷尀㴁尀", "after-end", 6],
    ["婌焳廔萷尀㴁㴁", "after-end", 6],
    ["婌㴀", "bad-end", 1],
  ];
  for (const [text, code, pos] of cases) {
    assert.throws(() => b.decode(text), (e) => e instanceof b.DecodeError && e.code === code && e.position === pos, text);
  }
});

test("forgiving decoding behaves like the reference tool", () => {
  const r = b.decodeDetailed("婌焳A廔萷", { strict: false });
  assert.equal(r.warnings[0].code, "foreign");
  assert.equal(new TextDecoder().decode(r.bytes), "1234567");
  // an incomplete final group without a marker is dropped
  assert.equal(new TextDecoder().decode(b.decodeDetailed("婌焳廔萷尀", { strict: false }).bytes), "1234567");
});

test("U+3D00 after a whole number of groups is accepted", () => {
  assert.equal(b.decodeText("婌焳廔萷㴀"), "1234567");
});

test("padding bits in the last character are ignored", () => {
  // 尀 (U+5C00) carries "8" and six zero bits; 封 (U+5C01) differs only in padding.
  assert.equal(b.decodeText("婌焳廔萷封㴁"), "12345678");
});

test("UTF-16 files: BOM, byte order and detection", () => {
  const s = b.encodeText("file");
  const be = b.toUTF16BE(s);
  assert.deepEqual([...be.subarray(0, 2)], [0xfe, 0xff]);
  assert.equal(b.toUTF16BE(s, { bom: false }).length, s.length * 2);
  assert.deepEqual(b.readText(be), { text: s, encoding: "utf-16be" });
  assert.deepEqual(b.readText(b.toUTF16BE(s, { bom: false })), { text: s, encoding: "utf-16be" });
  const le = Buffer.from(be.subarray(2)).swap16();
  assert.deepEqual(b.readText(Buffer.concat([Buffer.from([0xff, 0xfe]), le])), { text: s, encoding: "utf-16le" });
  assert.deepEqual(b.readText(bytes(s)), { text: s, encoding: "utf-8" });
  assert.deepEqual(b.readText(bytes("﻿" + s)), { text: s, encoding: "utf-8" });
});

async function pipe(stream, chunks) {
  const out = [];
  const writer = stream.writable.getWriter();
  const reading = (async () => { for await (const c of stream.readable) out.push(c); })();
  const writing = (async () => {
    for (const c of chunks) await writer.write(c);
    await writer.close();
  })();
  const [w, r] = await Promise.allSettled([writing, reading]);
  if (r.status === "rejected") throw r.reason;
  if (w.status === "rejected") throw w.reason;
  return out;
}

test("encoder stream equals one-shot encoding for any chunking", async () => {
  for (let i = 0; i < 60; i++) {
    const x = new Uint8Array(randomBytes(i * 13));
    const chunks = [];
    for (let p = 0; p < x.length;) { const k = 1 + Math.floor(Math.random() * 20); chunks.push(x.subarray(p, p + k)); p += k; }
    assert.equal((await pipe(new b.EncoderStream(), chunks)).join(""), b.encode(x));
  }
});

test("decoder stream equals one-shot decoding for any chunking", async () => {
  for (let i = 0; i < 60; i++) {
    const x = new Uint8Array(randomBytes(i * 13));
    const s = b.encode(x);
    const chunks = [];
    for (let p = 0; p < s.length;) { const k = 1 + Math.floor(Math.random() * 9); chunks.push(s.slice(p, p + k)); p += k; }
    assert.deepEqual(Buffer.concat(await pipe(new b.DecoderStream(), chunks)), Buffer.from(x));
  }
});

test("decoder stream reports the position in the whole stream", async () => {
  const s = b.encodeText("x".repeat(70));
  const broken = s.slice(0, 30) + "A" + s.slice(30);
  await assert.rejects(pipe(new b.DecoderStream(), [broken.slice(0, 20), broken.slice(20)]),
    (e) => e.code === "foreign" && e.position === 30);
});
