import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { PromptCard } from "@/components/PromptCard";
import { getUserProfile } from "@/lib/api/auth.functions";
import { listListings } from "@/lib/api/listings.functions";
import { MASCOTS } from "@/lib/mascots";
import { computeXP, computeLevel, computeBadges } from "@/lib/gamification";

export const Route = createFileRoute("/u/$username")({
  loader: async ({ params }) => {
    const profile = await getUserProfile({ data: { username: params.username } });
    if (!profile) throw notFound();
    const listings = await listListings({ data: { userId: profile.id, sort: "newest", limit: 12 } });
    return { profile, listings };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `@${loaderData.profile.username} — PromptStar` },
            { name: "description", content: `Check out @${loaderData.profile.username}'s prompts on PromptStar.` },
          ],
        }
      : {},
  component: CreatorProfile,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-5xl uppercase text-magenta">Creator not found</h1>
        <Link to="/" className="mt-4 inline-block underline font-bold">Back to market</Link>
      </div>
    </div>
  ),
});

function CreatorProfile() {
  const { profile, listings } = Route.useLoaderData();

  const xp = computeXP({
    listingsCount: profile.listingsCount,
    salesCount: profile.salesCount,
    savesReceived: profile.savesReceived,
    reviewsWritten: 0,
  });
  const { level, xpInLevel } = computeLevel(xp);
  const badges = computeBadges({
    listingsCount: profile.listingsCount,
    salesCount: profile.salesCount,
    savesReceived: profile.savesReceived,
    reviewsWritten: 0,
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 px-6 md:px-12 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile card */}
          <div className="md:col-span-1">
            <div className="bg-white border-4 border-ink p-6 shadow-pop sticky top-24">
              <div className="flex flex-col items-center text-center">
                <img
                  src={MASCOTS[profile.mascot].image}
                  alt="Avatar"
                  width={120}
                  height={120}
                  className="size-28 border-4 border-ink rounded-full bg-accent-yellow object-contain"
                />
                <h1 className="font-display text-2xl uppercase mt-3">@{profile.username}</h1>
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

                {profile.bio && (
                  <p className="text-sm text-ink/70 mt-4 pt-4 border-t-2 border-ink w-full">{profile.bio}</p>
                )}
              </div>

              <div className="mt-6 pt-6 border-t-2 border-ink space-y-3">
                <div className="flex justify-between font-bold uppercase text-xs">
                  <span className="text-ink/60">Listings</span>
                  <span className="text-magenta font-display text-base">{profile.listingsCount}</span>
                </div>
                <div className="flex justify-between font-bold uppercase text-xs">
                  <span className="text-ink/60">Sales</span>
                  <span className="text-magenta font-display text-base">{profile.salesCount}</span>
                </div>
                <div className="flex justify-between font-bold uppercase text-xs">
                  <span className="text-ink/60">Saves Received</span>
                  <span className="text-magenta font-display text-base">{profile.savesReceived}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Listings */}
          <div className="md:col-span-2">
            <h2 className="font-display text-3xl uppercase mb-5 border-b-4 border-ink pb-2">
              Prompts by <span className="text-magenta">@{profile.username}</span>
            </h2>
            {listings.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-ink">
                <div className="text-5xl mb-3">🎨</div>
                <p className="font-display text-2xl uppercase text-ink/40">No prompts yet</p>
                <p className="text-sm text-ink/60 mt-2">This creator hasn't published anything yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {listings.map((p) => (
                  <PromptCard key={p.id} prompt={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
