import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/Navbar";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { confirm } from "@/components/ui/confirm-dialog";
import { CURRENT_USER_QUERY_KEY, getCurrentUser, removeAvatar, resetTour, setMascot, updateAvatar, updateBio } from "@/lib/api/auth.functions";
import { MASCOTS, type MascotKey } from "@/lib/mascots";
import { ACCENT_THEMES, applyAccentTheme, getStoredAccentTheme, persistAccentTheme, type AccentTheme } from "@/lib/theme";
import { playTactileClick } from "@/lib/sound";
import { computeXP, computeLevel, computeBadges, type GamificationStats } from "@/lib/gamification";
import { getMyStats } from "@/lib/api/listings.functions";

export const Route = createFileRoute("/profile")({
  beforeLoad: async ({ context }) => {
    // Reuses the Navbar's cached session (same query key/fn) when it's still
    // fresh, instead of firing a second `getCurrentUser` round-trip on every
    // navigation here — that redundant request was the source of the lag.
    const user = await context.queryClient.ensureQueryData({
      queryKey: CURRENT_USER_QUERY_KEY,
      queryFn: getCurrentUser,
      staleTime: 60_000,
    });
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

const animationLevels = ["Off", "Low", "High"] as const;

function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = Route.useLoaderData();
  // Starts at the SSR-safe default; localStorage only exists client-side, so
  // reading it during the initial render would mismatch the server-rendered
  // markup and trigger a hydration warning. Sync it in after mount instead.
  const [theme, setTheme] = useState<AccentTheme>("magenta");

  useEffect(() => {
    setTheme(getStoredAccentTheme());
    const storedAnim = localStorage.getItem("anim_level");
    if (storedAnim && (animationLevels as readonly string[]).includes(storedAnim)) {
      setAnimLevel(storedAnim as (typeof animationLevels)[number]);
    }
    const storedFont = localStorage.getItem("font_size");
    if (storedFont) setFontSize(Number(storedFont));
    const storedBio = localStorage.getItem("profile_bio");
    if (storedBio) setBio(storedBio);
  }, []);
  const [animLevel, setAnimLevel] = useState<(typeof animationLevels)[number]>("High");
  const [fontSize, setFontSize] = useState(16);
  const [bio, setBio] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [companion, setCompanion] = useState<MascotKey>(user.mascot);
  const [savingCompanion, setSavingCompanion] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const [stats, setStats] = useState<GamificationStats>({ listingsCount: 0, salesCount: 0, savesReceived: 0, reviewsWritten: 0 });

  useEffect(() => {
    getMyStats().then((s) => setStats({ listingsCount: s.listingsCount, salesCount: s.salesCount, savesReceived: s.savesReceived, reviewsWritten: 0 }));
  }, []);

  const handlePickAnim = (lvl: (typeof animationLevels)[number]) => {
    setAnimLevel(lvl);
    localStorage.setItem("anim_level", lvl);
  };

  const handleFontChange = (size: number) => {
    setFontSize(size);
    localStorage.setItem("font_size", String(size));
  };

  const handleSaveBio = async () => {
    setSavingBio(true);
    try {
      await updateBio({ data: { bio } });
      localStorage.setItem("profile_bio", bio);
    } catch {
      // ignore
    } finally {
      setSavingBio(false);
    }
  };

  const handlePickTheme = (key: AccentTheme) => {
    if (key === theme) return;
    playTactileClick();
    setTheme(key);
    applyAccentTheme(key);
    persistAccentTheme(key);
  };

  const [replayingTour, setReplayingTour] = useState(false);
  const handleReplayTour = async () => {
    if (replayingTour) return;
    setReplayingTour(true);
    try {
      await resetTour();
      const fresh = await getCurrentUser();
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, fresh);
      await router.navigate({ to: "/dashboard" });
    } catch {
      setReplayingTour(false);
    }
  };

  const handlePickCompanion = async (key: MascotKey) => {
    if (key === companion || savingCompanion) return;
    const previous = companion;
    setCompanion(key);
    setSavingCompanion(true);
    try {
      await setMascot({ data: { mascot: key } });
      // Refresh the cached current user so the navbar avatar (and anything else
      // reading CURRENT_USER_QUERY_KEY) reflects the new companion immediately,
      // not just after a page refresh.
      await queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      await router.invalidate();
    } catch {
      setCompanion(previous);
    } finally {
      setSavingCompanion(false);
    }
  };

  // Step 1: pick a file — open the crop modal so the user can position it
  // before anything is uploaded.
  const handleAvatarFile = (file: File) => {
    setAvatarError(null);
    setCropError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = reader.result;
      if (typeof imageDataUrl !== "string") return;
      setCropImageSrc(imageDataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Step 2: user positions the photo and hits Save in the crop modal.
  const handleConfirmCrop = async (croppedDataUrl: string) => {
    setCropError(null);
    setSavingAvatar(true);
    try {
      const result = await updateAvatar({ data: { imageDataUrl: croppedDataUrl } });
      setAvatarUrl(result.avatarUrl);
      setCropImageSrc(null);
      await queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      await router.invalidate();
    } catch (err) {
      setCropError(err instanceof Error ? err.message : "Failed to upload avatar.");
    } finally {
      setSavingAvatar(false);
    }
  };

  // Two-step removal: confirm, then clear the avatar.
  const handleRemoveAvatar = async () => {
    const confirmed = await confirm({
      title: "Remove your photo?",
      description: "Your profile picture will be removed and replaced with your companion icon.",
      confirmText: "Remove",
      destructive: true,
    });
    if (!confirmed) return;

    setAvatarError(null);
    setSavingAvatar(true);
    try {
      await removeAvatar();
      setAvatarUrl(null);
      await queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      await router.invalidate();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Failed to remove avatar.");
    } finally {
      setSavingAvatar(false);
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
              {(() => {
                const xp = computeXP(stats);
                const { level, xpInLevel } = computeLevel(xp);
                const badges = computeBadges(stats);
                return (
              <div className="flex flex-col items-center text-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" width={120} height={120} className="size-28 border-4 border-ink rounded-full object-cover" />
                ) : (
                  <img src={MASCOTS[companion].image} alt="Avatar" width={120} height={120} className="size-28 border-4 border-ink rounded-full bg-accent-yellow object-contain" />
                )}
                <div className="flex items-center gap-2 mt-2">
                  <label className="cursor-pointer px-3 py-1 bg-magenta text-white font-bold uppercase text-[10px] border-2 border-ink shadow-[2px_2px_0_0_#0a0a0c] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all">
                    {savingAvatar ? "Saving…" : avatarUrl ? "Change Photo" : "Upload Photo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      disabled={savingAvatar}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAvatarFile(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={savingAvatar}
                      className="px-3 py-1 bg-white text-ink font-bold uppercase text-[10px] border-2 border-ink hover:bg-ink hover:text-white transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {avatarError && <p className="text-[10px] text-magenta font-bold mt-1">{avatarError}</p>}
                <h2 className="font-display text-2xl uppercase mt-3">@{user.username}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-1 bg-accent-yellow border-2 border-ink text-[10px] font-bold uppercase">Lv. {level}</span>
                  <span className="text-xs text-ink/60">Prompt Collector</span>
                </div>
                {/* XP bar */}
                <div className="w-full mt-3">
                  <div className="h-2 bg-ink/10 border border-ink overflow-hidden">
                    <div className="h-full bg-magenta transition-all" style={{ width: `${(xpInLevel / 1000) * 100}%` }} />
                  </div>
                  <div className="text-[10px] font-mono text-ink/50 mt-0.5">{xpInLevel} / 1000 XP</div>
                </div>
                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                  {badges.map((b) => (
                    <span
                      key={b.id}
                      title={b.label}
                      className={`px-2 py-0.5 border-2 text-[10px] font-bold uppercase tracking-wide transition-all ${
                        b.earned
                          ? "border-ink bg-accent-yellow text-ink"
                          : "border-ink/20 bg-ink/5 text-ink/30"
                      }`}
                    >
                      {b.icon} {b.label}
                    </span>
                  ))}
                </div>
              </div>
                );
              })()}

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
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="Collecting prompts across every style — cyberpunk, concept art, anime, and beyond."
                className="w-full bg-white border-2 border-ink p-3 font-medium focus:outline-none focus:ring-4 focus:ring-magenta/30"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-[10px] text-ink/40 font-mono">{bio.length}/300</span>
                <button
                  type="button"
                  onClick={handleSaveBio}
                  disabled={savingBio}
                  className="px-4 py-1.5 bg-magenta text-white font-bold uppercase text-xs border-2 border-ink shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50"
                >
                  {savingBio ? "Saving…" : "Save Bio"}
                </button>
              </div>
            </Section>

            <Section title="Accent Theme">
              <div className="grid grid-cols-4 gap-3">
                {(Object.keys(ACCENT_THEMES) as AccentTheme[]).map((key) => {
                  const t = ACCENT_THEMES[key];
                  const selected = theme === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePickTheme(key)}
                      aria-pressed={selected}
                      className={`p-3 border-2 border-ink font-bold uppercase text-xs transition-all ${
                        selected ? "shadow-[4px_4px_0_0_#0a0a0c] -translate-x-0.5 -translate-y-0.5" : "hover:translate-x-0.5"
                      }`}
                      style={{ background: t.hex, color: key === "yellow" ? "#0a0a0c" : "#fff" }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-ink/50 font-medium mt-3">
                Sets PromptStar's lead colour site-wide — eases in smoothly, saved to this browser.
              </p>
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
                    onClick={() => handlePickAnim(lvl)}
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
                onChange={(e) => handleFontChange(Number(e.target.value))}
                className="w-full accent-magenta"
              />
            </Section>

            <Section title="App Tour">
              <p className="text-sm text-ink/60 mb-3">Take the guided walkthrough of PromptStar again.</p>
              <button
                onClick={handleReplayTour}
                disabled={replayingTour}
                className="w-full py-3 border-2 border-ink font-bold uppercase text-sm bg-white hover:bg-accent-yellow transition-all shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50"
              >
                {replayingTour ? "Starting…" : "↺ Replay tour"}
              </button>
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
      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          saving={savingAvatar}
          error={cropError}
          onCancel={() => {
            setCropImageSrc(null);
            setCropError(null);
          }}
          onConfirm={handleConfirmCrop}
        />
      )}
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
