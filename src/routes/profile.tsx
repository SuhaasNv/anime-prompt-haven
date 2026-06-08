import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { getCurrentUser, setMascot } from "@/lib/api/auth.functions";
import { MASCOTS, type MascotKey } from "@/lib/mascots";

export const Route = createFileRoute("/profile")({
  beforeLoad: async () => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: "/auth" });
    }
    return { user };
  },
  loader: ({ context }) => ({ user: context.user }),
  head: () => ({
    meta: [
      { title: "Studio — PromptStar" },
      { name: "description", content: "Customize your profile and theme." },
    ],
  }),
  component: ProfilePage,
});

const themes = [
  { name: "Magenta", color: "#d400ff" },
  { name: "Orange", color: "#ff6600" },
  { name: "Yellow", color: "#ffcc00" },
  { name: "Purple", color: "#9d00ff" },
];

const animationLevels = ["Off", "Low", "High"] as const;

function ProfilePage() {
  const router = useRouter();
  const { user } = Route.useLoaderData();
  const [theme, setTheme] = useState("Magenta");
  const [animLevel, setAnimLevel] = useState<(typeof animationLevels)[number]>("High");
  const [fontSize, setFontSize] = useState(16);
  const [companion, setCompanion] = useState<MascotKey>(user.mascot);
  const [savingCompanion, setSavingCompanion] = useState(false);

  const handlePickCompanion = async (key: MascotKey) => {
    if (key === companion || savingCompanion) return;
    const previous = companion;
    setCompanion(key);
    setSavingCompanion(true);
    try {
      await setMascot({ data: { mascot: key } });
      await router.invalidate();
    } catch {
      setCompanion(previous);
    } finally {
      setSavingCompanion(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 px-6 md:px-12 py-10">
        <h1 className="font-display text-5xl md:text-6xl uppercase mb-2">
          My <span className="text-magenta">Studio</span>
        </h1>
        <p className="text-ink/70 font-medium mb-10">Tune your vibe. Your binder, your rules.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile card */}
          <div className="md:col-span-1">
            <div className="bg-white border-4 border-ink p-6 shadow-pop">
              <div className="flex flex-col items-center text-center">
                <img src={MASCOTS[companion].image} alt="Avatar" width={120} height={120} className="size-28 border-4 border-ink rounded-full bg-accent-yellow object-contain" />
                <h2 className="font-display text-2xl uppercase mt-3">@{user.username}</h2>
                <p className="text-xs text-ink/60 mt-1">Prompt Collector · Lv. 12</p>
                <div className="flex gap-2 mt-3">
                  <span className="px-2 py-1 bg-magenta text-white text-[10px] font-bold uppercase">Pro</span>
                  <span className="px-2 py-1 bg-accent-yellow text-ink text-[10px] font-bold uppercase border border-ink">Creator</span>
                </div>
                <button className="mt-5 w-full bg-ink text-white py-2 font-bold uppercase text-sm hover:bg-magenta transition-colors">
                  Change Avatar
                </button>
              </div>

              <div className="mt-6 pt-6 border-t-2 border-ink space-y-3">
                <Stat label="Saved" value="42" />
                <Stat label="Collections" value="3" />
                <Stat label="Published" value="7" />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="md:col-span-2 space-y-6">
            <Section title="Bio">
              <textarea
                defaultValue="Collecting hyperrealistic anime prompts. Mecha + magical girl supremacy."
                rows={3}
                className="w-full bg-white border-2 border-ink p-3 font-medium focus:outline-none focus:ring-4 focus:ring-magenta/30"
              />
            </Section>

            <Section title="Accent Theme">
              <div className="grid grid-cols-4 gap-3">
                {themes.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setTheme(t.name)}
                    className={`p-3 border-2 border-ink font-bold uppercase text-xs transition-all ${
                      theme === t.name ? "shadow-[4px_4px_0_0_#0a0a0c]" : "hover:translate-x-0.5"
                    }`}
                    style={{ background: t.color, color: t.color === "#ffcc00" ? "#0a0a0c" : "#fff" }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Companion">
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(MASCOTS) as MascotKey[]).map((key) => {
                  const m = MASCOTS[key];
                  const selected = companion === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePickCompanion(key)}
                      disabled={savingCompanion}
                      aria-pressed={selected}
                      className={`flex flex-col items-center gap-1 p-3 border-2 transition-all disabled:opacity-60 ${
                        selected
                          ? "border-ink bg-accent-yellow shadow-[4px_4px_0_0_#0a0a0c] -translate-x-0.5 -translate-y-0.5"
                          : "border-ink/30 bg-white hover:border-ink"
                      }`}
                    >
                      <img src={m.image} alt={m.name} width={64} height={64} className="size-16 object-contain" />
                      <span className="font-display uppercase text-sm leading-none">{m.name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-ink/50">{m.tagline}</span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Animation Intensity">
              <div className="flex gap-3">
                {animationLevels.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setAnimLevel(lvl)}
                    className={`flex-1 py-3 border-2 border-ink font-bold uppercase text-sm transition-all ${
                      animLevel === lvl ? "bg-ink text-white shadow-[4px_4px_0_0_#d400ff]" : "bg-white hover:bg-accent-yellow"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </Section>

            <Section title={`Font Size — ${fontSize}px`}>
              <input
                type="range"
                min={14}
                max={20}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-magenta"
              />
            </Section>

            <Section title="Account">
              <div className="space-y-2">
                <Row label="Email" value={user.email} />
                <Row label="Password" value="••••••••" />
                <Row label="Notifications" value="On" />
              </div>
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border-2 border-ink p-5">
      <h3 className="font-display text-lg uppercase mb-3 border-b-2 border-ink pb-2">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between font-bold uppercase text-xs">
      <span className="text-ink/60">{label}</span>
      <span className="text-magenta font-display text-base">{value}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-dashed border-ink/20 last:border-0">
      <span className="text-xs font-bold uppercase tracking-widest text-ink/60">{label}</span>
      <span className="font-mono text-sm">{value}</span>
      <button className="text-xs font-bold uppercase text-magenta hover:underline">Edit</button>
    </div>
  );
}
