import test from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { buildXlsx } from "./xlsx.js";

/** Reads a stored entry back out of the zip's central directory. */
function entries(zip: Buffer): Map<string, string> {
  const out = new Map<string, string>();
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let p = zip.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    assert.equal(zip.readUInt32LE(p), 0x02014b50);
    const size = zip.readUInt32LE(p + 20), nameLen = zip.readUInt16LE(p + 28), local = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nameLen).toString();
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    out.set(name, inflateRawSync(zip.subarray(start, start + size)).toString("utf8"));
    p += 46 + nameLen;
  }
  return out;
}

test("builds a workbook with every part Excel expects", () => {
  const files = entries(buildXlsx([{ name: "Summary", columns: [{ header: "Name" }, { header: "Hours" }], rows: [["Ada", 7.5], ["Bob & Co", null]] }, { name: "Leave", columns: [{ header: "X" }], rows: [] }]));
  for (const f of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]) assert.ok(files.has(f), f);
  const sheet = files.get("xl/worksheets/sheet1.xml")!;
  assert.match(sheet, /<v>7\.5<\/v>/);
  assert.match(sheet, /Bob &amp; Co/);
  assert.match(sheet, /<autoFilter ref="A1:B3"\/>/);
  assert.match(files.get("xl/workbook.xml")!, /name="Summary"[\s\S]*name="Leave"/);
});

test("formula-looking text stays text, and control characters are dropped", () => {
  const sheet = entries(buildXlsx([{ name: "S", columns: [{ header: "A" }], rows: [["=HYPERLINK(\"x\")\u0001"]] }])).get("xl/worksheets/sheet1.xml")!;
  assert.match(sheet, /t="inlineStr"/);
  assert.doesNotMatch(sheet, /<f>/);
  assert.doesNotMatch(sheet, /\u0001/);
});

test("refuses an empty workbook", () => assert.throws(() => buildXlsx([])));
