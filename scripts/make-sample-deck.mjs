// Generates a small, real PDF presentation used as the bundled sample deck and as a test fixture.
// Plain PDF operators only (Helvetica, rectangles), so it needs no dependencies.
// Run: node scripts/make-sample-deck.mjs
import { writeFileSync } from "node:fs";

const W = 960;
const H = 540;
const esc = (value) => value.replace(/[\\()]/g, (char) => `\\${char}`);
const text = (font, size, x, y, value, color = INK) => `${color} BT /${font} ${size} Tf ${x} ${y} Td (${esc(value)}) Tj ET`;
const rect = (x, y, w, h, color) => `${color} ${x} ${y} ${w} ${h} re f`;
const INK = "0.03 0.02 0 rg";
const MUTED = "0.38 0.35 0.33 rg";
const BAR = "0.8 0.78 0.76 rg";
const BLUE = "0.153 0.604 0.945 rg";
const POWDER = "0.988 0.894 0.847 rg";
const WHITE = "1 1 1 rg";

function frame(n, eyebrow, title) {
  return [
    rect(0, 0, W, H, WHITE),
    rect(0, H - 8, W, 8, POWDER),
    text("F1", 13, 64, 470, eyebrow.toUpperCase(), MUTED),
    text("F2", 40, 64, 418, title),
    text("F1", 12, W - 90, 36, `${n} / 6`, MUTED),
  ];
}

function bullets(items, top = 340) {
  return items.flatMap((item, index) => [rect(66, top - index * 58 + 6, 8, 8, BLUE), text("F1", 24, 92, top - index * 58, item)]);
}

const pages = [
  [
    rect(0, 0, W, H, WHITE),
    rect(0, 0, 18, H, BLUE),
    text("F1", 16, 72, 360, "PRODUCT STRATEGY REVIEW", MUTED),
    text("F2", 58, 72, 290, "A quieter way to launch"),
    text("F1", 22, 72, 244, "Start small, learn quickly, scale when the signal is clear.", MUTED),
    text("F1", 14, 72, 72, "Northwind Labs  |  Q3 planning", MUTED),
  ],
  [
    ...frame(2, "The signal", "Clarity is already compounding"),
    text("F1", 22, 64, 350, "Activation rose from 61% to 74% in six weeks."),
    text("F1", 18, 64, 316, "Traffic stayed flat. The first ten minutes got easier.", MUTED),
    rect(560, 90, 70, 150, BAR),
    rect(660, 90, 70, 172, BAR),
    rect(760, 90, 70, 222, BLUE),
    text("F1", 14, 574, 66, "Week 1", MUTED),
    text("F1", 14, 674, 66, "Week 3", MUTED),
    text("F1", 14, 774, 66, "Week 6", MUTED),
    text("F2", 18, 574, 248, "61%"),
    text("F2", 18, 674, 270, "66%"),
    text("F2", 18, 774, 320, "74%"),
  ],
  [...frame(3, "The plan", "Three deliberate moves"), ...bullets(["Invite the users who feel the problem most sharply", "Give them a guided first week", "Let what we learn shape the public story"])],
  [...frame(4, "Measurement", "What we will watch"), ...bullets(["Week-one activation, target 80%", "Support tickets per new account", "Share of invited users who invite a teammate"])],
  [...frame(5, "Risks", "What could go wrong"), ...bullets(["A small cohort may not represent everyone", "The guided week needs two people from support", "Competitors may launch louder first"])],
  [
    rect(0, 0, W, H, WHITE),
    rect(0, 0, W, 8, BLUE),
    text("F1", 13, 64, 470, "THE ASK", MUTED),
    text("F2", 44, 64, 380, "One focused month."),
    text("F2", 44, 64, 324, "One shared measure of success."),
    text("F2", 44, 64, 268, "Permission to learn before we amplify."),
    text("F1", 12, W - 90, 36, "6 / 6", MUTED),
  ],
];

const objects = [];
const add = (body) => {
  objects.push(body);
  return objects.length;
};
const catalog = add("");
const pagesObj = add("");
const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
const kids = pages.map((ops) => {
  const stream = ops.join("\n");
  const content = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  return add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`);
});
objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R /Info << /Title (A quieter way to launch) >> >>`;
objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(" ")}] /Count ${kids.length} >>`;

let pdf = "%PDF-1.4\n";
const offsets = [];
objects.forEach((body, index) => {
  offsets.push(Buffer.byteLength(pdf, "latin1"));
  pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

for (const target of ["public/sample-deck.pdf", "tests/fixtures/sample-deck.pdf"]) writeFileSync(target, Buffer.from(pdf, "latin1"));
console.log(`Wrote ${pages.length}-page sample deck (${Buffer.byteLength(pdf, "latin1")} bytes).`);
