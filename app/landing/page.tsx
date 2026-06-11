import Link from "next/link";

const FEATURES = [
  {
    icon: "⚡",
    title: "Smart Filtering",
    desc: "Lore reads your inbox and surfaces only the newsletters worth listening to — no notifications, no promotions.",
  },
  {
    icon: "✦",
    title: "Word Sync",
    desc: "Every word highlights as it's spoken, so you can follow along without losing your place.",
  },
  {
    icon: "🎧",
    title: "Your personal feed",
    desc: "Morning Brew, Stratechery, James Clear — all in one queue, ready to play on your commute.",
  },
];

const NEWSLETTERS = [
  { name: "Morning Brew", cat: "Business", freq: "Daily" },
  { name: "Stratechery", cat: "Tech", freq: "Weekly" },
  { name: "James Clear", cat: "Productivity", freq: "Weekly" },
  { name: "The Pragmatic Engineer", cat: "Engineering", freq: "Weekly" },
  { name: "Sahil Bloom", cat: "Growth", freq: "Bi-weekly" },
  { name: "Every", cat: "Thinking", freq: "Daily" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-paper text-ink font-sans">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-indigo text-white font-bold text-sm">
              L
            </div>
            <span className="text-[17px] font-bold tracking-tight">Lore!</span>
          </div>
          <Link
            href="/"
            className="rounded-btn bg-indigo px-4 py-2 text-[13px] font-semibold text-white"
          >
            Open Playground
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-2xl px-5 pt-14 pb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-pill bg-teal50 px-3 py-1.5 text-[12px] font-semibold text-teal">
          <span>✦</span>
          <span>Turn newsletters into audio, instantly</span>
        </div>
        <h1 className="mb-4 text-[38px] font-extrabold leading-tight tracking-tight sm:text-[46px]">
          Your inbox,{" "}
          <span className="text-indigo">as a podcast</span>
        </h1>
        <p className="mb-8 text-[16px] leading-relaxed text-muted">
          Lore connects to Gmail, finds your newsletters, and converts them into
          high-quality audio using Kokoro TTS — complete with word-by-word
          sync so you never lose your place.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href="#"
            className="flex items-center justify-center gap-2 rounded-[14px] bg-indigo px-6 py-4 text-[16px] font-bold text-white shadow-lg shadow-indigo/20"
          >
            <span>Get Started for Free</span>
            <span>→</span>
          </a>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 rounded-[14px] border-2 border-border px-6 py-4 text-[16px] font-semibold text-ink"
          >
            See how it works
          </Link>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="mx-auto max-w-2xl px-5 pb-14">
        <div className="grid gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex gap-4 rounded-card border border-border bg-white p-5"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-surface text-[24px]">
                {f.icon}
              </div>
              <div>
                <h3 className="mb-1 text-[16px] font-bold">{f.title}</h3>
                <p className="text-[14px] leading-relaxed text-muted">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Featured newsletters ── */}
      <section className="border-t border-border bg-surface px-5 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[22px] font-extrabold tracking-tight">
              Featured Newsletters
            </h2>
            <span className="rounded-pill bg-teal50 px-3 py-1 text-[12px] font-bold text-teal">
              +50 more
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {NEWSLETTERS.map((nl) => (
              <div
                key={nl.name}
                className="rounded-card border border-border bg-white p-4"
              >
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-[10px] bg-indigo text-white font-bold text-[16px]">
                  {nl.name[0]}
                </div>
                <p className="text-[14px] font-bold leading-snug">{nl.name}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {nl.cat} · {nl.freq}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA strip ── */}
      <section className="bg-ink px-5 py-14 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-3 text-[28px] font-extrabold text-white">
            Start listening in 60 seconds
          </h2>
          <p className="mb-8 text-[15px] text-white/60">
            Connect Gmail once. Lore does the rest.
          </p>
          <a
            href="#"
            className="inline-flex items-center gap-2 rounded-[14px] bg-teal px-8 py-4 text-[16px] font-bold text-white shadow-lg shadow-teal/30"
          >
            Connect Gmail <span>→</span>
          </a>
          <p className="mt-4 text-[13px] text-white/40">
            🔒 Read-only access · No emails stored · Free to start
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-paper px-5 py-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between text-[13px] text-muted">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-indigo text-white font-bold text-[11px]">
              L
            </div>
            <span className="font-semibold text-ink">Lore!</span>
          </div>
          <div className="flex gap-5">
            <a href="#" className="hover:text-ink">Privacy</a>
            <a href="#" className="hover:text-ink">Terms</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
