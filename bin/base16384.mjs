#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { readFileSync, writeFileSync } from "node:fs";
import { encode, decodeDetailed, toUTF16BE, readText, DecodeError, VERSION } from "../src/base16384.mjs";

const HELP = `base16384 ${VERSION} (base16384-js) — encode binary data as printable text, and back

Usage:
  base16384 -[ed][t][n] [inputfile] [outputfile]
  base16384 [options] [inputfile] [outputfile]

  -e, --encode      encode (default)
  -d, --decode      decode
  -t, --time        report the time taken on standard error
  -n, --no-header   encode: do not write the UTF-16BE byte order mark (FE FF)
  -u, --utf8        encode: write UTF-8 text instead of UTF-16BE
                    (the default when writing to a terminal)
  -l, --lenient     decode: skip foreign characters and report problems as warnings
  -h, --help        show this help
  -V, --version     show the version

  inputfile         a file, or - (or nothing) for standard input
  outputfile        a file, or - (or nothing) for standard output

Decoding reads UTF-16BE, UTF-16LE (with a byte order mark) or UTF-8, and ignores
whitespace. The checksum options -c and -C of other implementations are not supported.

Exit status: 0 success, 1 bad input, 2 usage error.`;

const o = { decode: false, time: false, noHeader: false, utf8: null, lenient: false };
const files = [];
for (const a of process.argv.slice(2)) {
  if (a === "-" || !a.startsWith("-")) { files.push(a); continue; }
  if (a.startsWith("--")) {
    const map = { "--encode": () => (o.decode = false), "--decode": () => (o.decode = true), "--time": () => (o.time = true),
      "--no-header": () => (o.noHeader = true), "--utf8": () => (o.utf8 = true), "--lenient": () => (o.lenient = true),
      "--help": () => done(HELP), "--version": () => done(VERSION) };
    (map[a] || (() => fail(2, `unknown option ${a}\nTry 'base16384 --help'.`)))();
    continue;
  }
  for (const f of a.slice(1)) {
    if (f === "e") o.decode = false;
    else if (f === "d") o.decode = true;
    else if (f === "t") o.time = true;
    else if (f === "n") o.noHeader = true;
    else if (f === "u") o.utf8 = true;
    else if (f === "l") o.lenient = true;
    else if (f === "h") done(HELP);
    else if (f === "V") done(VERSION);
    else if (f === "c" || f === "C") fail(2, "base16384: the checksum options -c and -C are not supported");
    else fail(2, `base16384: unknown option -${f}\nTry 'base16384 --help'.`);
  }
}
if (files.length > 2) fail(2, "base16384: at most an input and an output file");

const [input = "-", output = "-"] = files;
const toStdout = output === "-";
const started = performance.now();
const data = readFileSync(input === "-" ? 0 : input);
let result;

if (o.decode) {
  let r;
  try {
    r = decodeDetailed(readText(data).text, { strict: !o.lenient });
  } catch (e) {
    if (e instanceof DecodeError) fail(1, `base16384: ${e.message}${e.position >= 0 ? ` (character ${e.position + 1})` : ""}`);
    throw e;
  }
  for (const w of r.warnings) process.stderr.write(`base16384: warning: ${w.message}${w.position >= 0 ? ` (character ${w.position + 1})` : ""}\n`);
  result = r.bytes;
} else {
  const text = encode(data);
  const utf8 = o.utf8 ?? (toStdout && process.stdout.isTTY);
  result = utf8 ? Buffer.from(text + (toStdout && process.stdout.isTTY ? "\n" : ""), "utf8") : toUTF16BE(text, { bom: !o.noHeader });
}

if (toStdout) process.stdout.write(result);
else writeFileSync(output, result);
if (o.time) process.stderr.write(`spend time: ${(performance.now() - started).toFixed(1)}ms\n`);

function done(msg) {
  process.stdout.write(msg + "\n");
  process.exit(0);
}
function fail(code, msg) {
  process.stderr.write(msg + "\n");
  process.exit(code);
}
