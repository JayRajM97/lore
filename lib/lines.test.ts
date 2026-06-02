// Standalone test for the lyrics line-splitter + timestamps. Run:
//   npm run test:lines
import assert from "node:assert";
import { buildLines, activeLineIndex, wc } from "./lines";

// Verified preprocessor output (James Clear 3-2-1) — the lyrics view's input.
const TTS = `Here are three ideas from James Clear.

One.

Improvement is being better than your past self. It doesn't have to be more complicated than that. Do not compare against others, compare against your past self. Keep the focus internal.

[pause]

Two quotes from others.

One. Baba Hari Dass, yoga master, on learning: "Teach in order to learn."

[pause]

And one question to sit with.

Are you building or maintaining?

[pause]

Until next week, James Clear.`;

let passed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  assert.ok(cond, `FAILED: ${name}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ""}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

const DUR = 95;
const lines = buildLines(TTS, DUR);
const texts = lines.map((l) => l.text);

console.log("\n=== splitting ===");
check("idea I is one line", texts.includes("Improvement is being better than your past self."));
check("comma sentence split A", texts.includes("Do not compare against others,"));
check("comma sentence split B", texts.includes("compare against your past self."));
check("short sentence kept", texts.includes("Keep the focus internal."));
check("question line present", texts.includes("Are you building or maintaining?"));

console.log("\n=== classification ===");
const headers = lines.filter((l) => l.kind === "header");
check("header: ideas intro", headers.some((l) => /three ideas from James Clear/i.test(l.text)));
check("header: quotes intro", headers.some((l) => /quotes from others/i.test(l.text)));
check("header: question intro", headers.some((l) => /question to sit with/i.test(l.text)));
check("headers non-tappable", headers.every((l) => !l.tappable));
const pauses = lines.filter((l) => l.kind === "pause");
check("pause lines present (3)", pauses.length === 3, pauses.length);
check("pause non-tappable", pauses.every((l) => !l.tappable));
check("normal lines tappable", lines.filter((l) => l.kind === "normal").every((l) => l.tappable));

console.log("\n=== timestamps ===");
let mono = true;
for (let i = 1; i < lines.length; i++) if (lines[i].start_time < lines[i - 1].start_time - 1e-6) mono = false;
check("start_times monotonic", mono);
check("starts within [0,dur]", lines.every((l) => l.start_time >= 0 && l.start_time <= DUR + 0.01));
check("last end ≈ duration", Math.abs(lines[lines.length - 1].end_time - DUR) < 1.5, lines[lines.length - 1].end_time);
check("activeLineIndex @0 = first", activeLineIndex(lines, 0.001) === 0);
check("activeLineIndex past end = last", activeLineIndex(lines, DUR + 5) === lines.length - 1);

console.log("\n=== real-word snapping ===");
// fake real timestamps: one per spoken word, 0.5s each, in order
const spoken = lines.filter((l) => l.kind === "normal" || l.kind === "header");
const totalWords = spoken.reduce((n, l) => n + wc(l.text), 0);
const words = Array.from({ length: totalWords }, (_, i) => ({ start: i * 0.5, end: i * 0.5 + 0.5 }));
const snapped = buildLines(TTS, DUR, words);
const firstSpoken = snapped.find((l) => l.kind === "normal" || l.kind === "header")!;
check("first spoken line snaps to word 0", firstSpoken.start_time === 0, firstSpoken.start_time);
let snapMono = true;
for (let i = 1; i < snapped.length; i++) if (snapped[i].start_time < snapped[i - 1].start_time - 1e-6) snapMono = false;
check("snapped starts monotonic", snapMono);

console.log(`\n✅ ${passed} checks passed`);
console.log("\n── first 12 lines ──");
lines.slice(0, 12).forEach((l) =>
  console.log(`  [${l.kind.padEnd(7)}] ${l.start_time.toFixed(1)}-${l.end_time.toFixed(1)}  ${l.text}`)
);
