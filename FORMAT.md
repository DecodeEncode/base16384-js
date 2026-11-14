# The base16384 format, as implemented here

This note describes the format as base16384-js reads and writes it. The behaviour of the reference command-line tool ([fumiama/base16384](https://github.com/fumiama/base16384)) described here was determined by testing version 2.3.2 from the outside, using `tools/conformance.mjs`.

## Alphabet

The format has 16384 data characters, U+4E00 to U+8DFF, where character U+4E00 + *v* stands for the 14-bit value *v*. Six end markers, U+3D01 to U+3D06, record the length of a short final group.

## Encoding

1. Take the input seven bytes at a time. Seven bytes are 56 bits, which split into four 14-bit values, most significant first. Each value is written as one character.
2. If 1 to 6 bytes remain, pad them with zero bits to a multiple of 14 and write the characters needed, then the end marker U+3D00 + *r*, where *r* is the number of remaining bytes.

| bytes left (*r*) | characters | end marker |
|---|---|---|
| 1 | 1 | U+3D01 |
| 2 | 2 | U+3D02 |
| 3 | 2 | U+3D03 |
| 4 | 3 | U+3D04 |
| 5 | 3 | U+3D05 |
| 6 | 4 | U+3D06 |

Encoding *n* bytes therefore gives 4 × ⌊*n*/7⌋ characters, plus the short group and its marker when *n* is not a multiple of 7.

As text, the result is a sequence of UTF-16 code units. The reference tool writes files as UTF-16BE preceded by the byte order mark FE FF, or without it when given `-n`.

## Decoding in this library

Whitespace is ignored, and so is a byte order mark at the start. The decoder then accepts data characters followed by at most one end marker. The number of characters before the marker must match the table above; without a marker, it must be a multiple of four. Padding bits are not checked.

The strict decoder, which is the default, rejects anything else and reports the code and position:

| code | meaning |
|---|---|
| `foreign` | a character that is not a data character, an end marker, whitespace or a leading byte order mark |
| `no-end` | the final group is incomplete and has no end marker |
| `bad-end` | the end marker does not match the number of characters before it |
| `after-end` | data or another marker after the end marker |

The forgiving decoder skips foreign characters and drops an incomplete final group without a marker, which is what the reference tool does. If an end marker claims more bytes than its characters hold, it decodes only the bytes that are actually there. Each problem is returned as a warning.

## Differences from the reference tool

Text written by the reference tool's encoder decodes to the same bytes here, and the reference tool decodes this library's output. The table below lists where the two differ.

| situation | reference tool 2.3.2 | this library |
|---|---|---|
| whitespace or line breaks in the input | decoded as data, corrupting the output | ignored |
| characters outside the alphabet | decoded as data | rejected, or skipped when forgiving |
| inconsistent end marker | accepted | rejected, or reported when forgiving |
| U+3D00 after a whole number of groups (written by some other encoders) | — | accepted as "no remainder" |
| padding bits of the last character | usually zero; for inputs larger than its read buffer (about 64 KiB) they can hold leftover data | always written as zero, ignored when reading |
| `-c` / `-C` checksum in the remainder | supported | not supported |
| UTF-16LE or UTF-8 input files | not recognised | recognised by their byte order mark, or by content |

The padding difference means output is byte-identical to the reference tool's for inputs below its buffer size. Above that size, the last character can differ in its padding bits only, and both decoders ignore those bits.
