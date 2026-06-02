// Standalone test — no framework. Run via the installed TypeScript compiler:
//   npx tsc lib/preprocessNewsletter.ts lib/preprocessNewsletter.test.ts \
//     --outDir /tmp/lore-test --module commonjs --target es2020 --esModuleInterop
//   node /tmp/lore-test/preprocessNewsletter.test.js
//
// (see package.json scripts: `npm run test:preprocess`)

import assert from "node:assert";
import { preprocessNewsletter } from "./preprocessNewsletter";

// Representative raw James Clear 3-2-1 (April 30, 2026), with all the noise a
// real .eml carries: greeting, website line, P.S. + image, book recs, footer,
// "what else", unsubscribe.
const RAW = `From: James Clear <james@jamesclear.com>
Subject: 3-2-1: On making adjustments, taking things seriously, and the value of learning
Date: April 30, 2026

Happy 3-2-1 Thursday!

Read this on jamesclear.com

3 Ideas From Me

I.
Improvement is being better than your past self. It doesn't have to be more complicated than that. Do not compare against others, compare against your past self. Keep the focus internal.

II.
You can take things seriously without taking them personally. Our tendency is to turn any criticism or complaint into a personal attack. We reply to it, defend against it, build a counter-argument, lose sleep over it. You don't have to eat everything that is served to you. You can respond to criticism without digesting criticism. Take what's useful, do your best to improve, and leave the rest.

III.
With a bow and arrow, you aim before you shoot. But in most areas of life, aiming is something you can do throughout the process. You can always adjust: your career path, your business strategy, your relationships, your workout program, your plans for next Wednesday. It's all adjustable along the way. So, pick a direction and get moving. Once you start, you learn along the way and there are plenty of opportunities to refine your plan.

2 Quotes From Others

I.
Baba Hari Dass, a yoga master and monk who kept a vow of silence from 1952 until his death in 2018, on learning:
"Teach in order to learn."

II.
Computer scientist Alan Kay on the limits of perception:
"A frog's brain is set up to recognize food as moving objects that are oblong in shape..."

1 Question For You

Are you building or maintaining?

Until next week,
James Clear

P.S. Here's a funny one about deadlines.
(image: a cat staring at a wall calendar)
https://jamesclear.com/ps/funny-image

Recommended Reading
Atomic Habits by James Clear — https://www.amazon.com/dp/0735211299
Deep Work by Cal Newport — https://www.amazon.com/dp/1455586692
Mindset by Carol Dweck — https://www.amazon.com/dp/0345472322

What else am I working on?
I'm putting together a new workshop on habits. More soon.

James Clear · Cofounder of Ship 30 for 30
Unsubscribe · Manage preferences
`;

let passed = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  assert.ok(cond, `FAILED: ${name}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ""}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

const out = preprocessNewsletter(RAW);

console.log("\n=== metadata ===");
check("newsletter_id", out.newsletter_id === "james-clear-2026-04-30", out.newsletter_id);
check("sender", out.sender === "James Clear", out.sender);
check("date parsed", out.date === "April 30, 2026", out.date);
check("subject captured", out.subject.startsWith("3-2-1:"), out.subject);
check("structure_type 3-2-1", out.structure_type === "3-2-1", out.structure_type);

console.log("\n=== sections ===");
const ideas = out.sections.find((s) => s.type === "ideas");
const quotes = out.sections.find((s) => s.type === "quotes");
const question = out.sections.find((s) => s.type === "question");
check("3 ideas parsed", ideas?.items?.length === 3, ideas?.items?.length);
check("idea indices I/II/III", JSON.stringify(ideas?.items?.map((i) => i.index)) === '["I","II","III"]', ideas?.items?.map((i) => i.index));
check("idea I content", !!ideas?.items?.[0].content.startsWith("Improvement is being better"), ideas?.items?.[0].content.slice(0, 30));
check("idea word_count > 0", (ideas?.items?.[0].word_count || 0) > 5, ideas?.items?.[0].word_count);
check("idea is_core", ideas?.items?.every((i) => i.is_core) === true);
check("2 quotes parsed", quotes?.items?.length === 2, quotes?.items?.length);
check("1 question parsed", question?.items?.length === 1, question?.items?.length);
check("question content", question?.items?.[0].content === "Are you building or maintaining?", question?.items?.[0].content);

console.log("\n=== images & skips ===");
check("image_count 1", out.image_count === 1, out.image_count);
check("skip: book recommendations", out.skipped_sections.includes("book recommendations"));
check("skip: footer", out.skipped_sections.includes("footer"));
check("skip: ps", out.skipped_sections.includes("ps"));
check("skip: unsubscribe", out.skipped_sections.includes("unsubscribe"));

console.log("\n=== tts_script ===");
const s = out.tts_script;
check("intro: three ideas from James Clear", s.includes("Here are three ideas from James Clear."));
check("ordinal break 'One.'", /\bOne\./.test(s));
check("ordinal break 'Two.'", /\bTwo\./.test(s));
check("ordinal break 'Three.'", /\bThree\./.test(s));
check("quotes intro", s.includes("Two quotes from others."));
check("compressed attribution", s.includes("Baba Hari Dass, yoga master, on learning:"), s.match(/Baba[^\n]*/)?.[0]);
check("quote text preserved", s.includes('"Teach in order to learn."'));
check("question intro", s.includes("And one question to sit with."));
check("question in script", s.includes("Are you building or maintaining?"));
check("signoff kept", s.includes("Until next week, James Clear."));
check("[pause] markers present", (s.match(/\[pause\]/g) || []).length >= 5, (s.match(/\[pause\]/g) || []).length);
check("no URLs in script", !/https?:\/\//.test(s));
check("no markdown asterisks", !/\*/.test(s));
check("skipped content absent (Atomic Habits)", !s.includes("Atomic Habits"));
check("skipped content absent (Unsubscribe)", !/unsubscribe/i.test(s));
check("greeting absent", !/Happy 3-2-1 Thursday/i.test(s));

console.log("\n=== duration ===");
const wc = s.replace(/\[pause\]/g, " ").trim().split(/\s+/).filter(Boolean).length;
check("duration matches formula", out.estimated_duration_s === Math.round((wc / 140) * 60), { dur: out.estimated_duration_s, wc });

console.log(`\n✅ ${passed} checks passed\n`);
console.log("───── tts_script ─────\n" + out.tts_script + "\n──────────────────────");
