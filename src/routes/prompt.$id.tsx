import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { SaveToCollectionModal } from "@/components/SaveToCollectionModal";
import { ReportModal } from "@/components/ReportModal";
import { getListing, incrementViewCount, deleteListing, updateListing } from "@/lib/api/listings.functions";
import { getPrompt, PROMPTS, type Prompt } from "@/lib/mock-data";
import { getCurrentUser } from "@/lib/api/auth.functions";
import { isSaved, savePrompt, unsavePrompt } from "@/lib/api/saves.functions";
import { purchaseListing, hasPurchased } from "@/lib/api/purchases.functions";
import { listReviews, getAverageRating, hasUserReviewed, createReview } from "@/lib/api/reviews.functions";
import { getMyCredits } from "@/lib/api/credits.functions";
import { recordCopy } from "@/lib/api/copies.functions";

export const Route = createFileRoute("/prompt/$id")({
  loader: async ({ params }) => {
    const prompt = getPrompt(params.id) ?? (await getListing({ data: { id: params.id } }));
    if (!prompt) throw notFound();
    return { prompt };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.prompt.title} — PromptStar` },
            { name: "description", content: loaderData.prompt.description },
            { property: "og:title", content: loaderData.prompt.title },
            { property: "og:description", content: loaderData.prompt.description },
            { property: "og:image", content: loaderData.prompt.image },
            { name: "twitter:image", content: loaderData.prompt.image },
          ],
        }
      : {},
  component: PromptDetail,
  notFoundComponent: () => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="font-display text-5xl uppercase text-magenta">Prompt vanished</h1>
        <Link to="/" className="mt-4 inline-block underline font-bold">Back to market</Link>
      </div>
    </div>
  ),
  errorComponent: () => <div className="p-10">Something glitched.</div>,
});

interface Review {
  id: string;
  username: string;
  rating: number;
  body: string;
  createdAt: string;
}

function PromptDetail() {
  const router = useRouter();
  const { prompt } = Route.useLoaderData() as { prompt: Prompt };
  const [modalOpen, setModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);
  const [userCredits, setUserCredits] = useState(0);
  const [hasOwnedListing, setHasOwnedListing] = useState(false);
  const [buying, setBuying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const related = PROMPTS.filter((p) => p.id !== prompt.id).slice(0, 3);

  // Load initial data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Increment view count (fire and forget)
        await incrementViewCount({ data: { id: prompt.id } });

        // Load reviews and rating
        const [reviewsList, rating] = await Promise.all([
          listReviews({ data: { listingId: prompt.id } }),
          getAverageRating({ data: { listingId: prompt.id } }),
        ]);
        setReviews(reviewsList as Review[]);
        setAvgRating(rating.average);

        // Load user data
        const user = await getCurrentUser();
        setCurrentUser(user);

        if (user) {
          // Check if user has saved this listing
          const savedData = await isSaved({ data: { listingId: prompt.id } });
          setSaved(savedData.saved);

          // Load user credits
          const credits = await getMyCredits();
          setUserCredits(credits.balance);

          // Check if user has purchased
          const purchased = await hasPurchased({ data: { listingId: prompt.id } });
          setHasOwnedListing(purchased.purchased);

          // Check if user already reviewed
          if (purchased.purchased) {
            const reviewed = await hasUserReviewed({ data: { listingId: prompt.id } });
            setHasAlreadyReviewed(reviewed.reviewed);
          }
        }
      } catch (err) {
        console.error("Failed to load prompt details", err);
      }
    };
    loadData();
  }, [prompt.id]);

  const copy = () => {
    navigator.clipboard.writeText(prompt.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    // Fire-and-forget: awards author their copy commission
    if (prompt.id) {
      recordCopy({ data: { listingId: prompt.id } }).catch(() => {});
    }
  };

  const handleSaveToggle = async () => {
    if (!currentUser) {
      router.navigate({ to: "/auth" });
      return;
    }
    try {
      if (saved) {
        await unsavePrompt({ data: { listingId: prompt.id } });
        setSaved(false);
      } else {
        await savePrompt({ data: { listingId: prompt.id } });
        setSaved(true);
      }
    } catch (err) {
      console.error("Failed to toggle save", err);
    }
  };

  const handlePurchase = async () => {
    if (!currentUser) {
      router.navigate({ to: "/auth" });
      return;
    }
    if (userCredits < prompt.price) {
      alert(`Insufficient credits. You need $${prompt.price}, you have $${userCredits.toFixed(2)}.`);
      return;
    }
    setBuying(true);
    try {
      const result = await purchaseListing({ data: { listingId: prompt.id } });
      setUserCredits(result.newBalance);
      setHasOwnedListing(true);
      alert("Purchase successful! 🎉");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Purchase failed";
      alert(message);
    } finally {
      setBuying(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    setDeleting(true);
    try {
      await deleteListing({ data: { id: prompt.id } });
      await router.navigate({ to: "/" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenEdit = () => {
    setEditTitle(prompt.title);
    setEditDescription(prompt.description);
    setEditBody(prompt.body);
    setEditPrice(prompt.price);
    setEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateListing({ data: { id: prompt.id, title: editTitle, description: editDescription, body: editBody, price: editPrice } });
      await router.invalidate();
      setEditOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await createReview({ data: { listingId: prompt.id, rating: reviewRating, body: reviewBody } });
      const [reviewsList, rating] = await Promise.all([
        listReviews({ data: { listingId: prompt.id } }),
        getAverageRating({ data: { listingId: prompt.id } }),
      ]);
      setReviews(reviewsList as Review[]);
      setAvgRating(rating.average);
      setHasAlreadyReviewed(true);
      setReviewBody("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const isOwner = currentUser && currentUser.id === (prompt as any).userId;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 px-6 md:px-12 py-10">
        <Link
          to="/"
          className="inline-block text-sm font-bold uppercase tracking-wider mb-6 hover:text-magenta transition-colors"
        >
          ← Back to Market
        </Link>

        <div className="grid grid-cols-12 gap-10">
          <div className="col-span-12 lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="border-4 border-ink shadow-pop-lg bg-white"
            >
              <img
                src={prompt.image}
                alt={prompt.title}
                width={1024}
                height={768}
                className="w-full aspect-[4/3] object-cover"
              />
            </motion.div>

            <div className="mt-8 bg-ink text-white p-6 border-4 border-magenta">
              <div className="flex items-center justify-between mb-3">
                <span className="font-display uppercase text-magenta">The Prompt</span>
                <button
                  onClick={copy}
                  className="bg-accent-yellow text-ink px-3 py-1 border-2 border-white font-bold uppercase text-xs hover:bg-accent-orange hover:text-white transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed text-white/90">
{prompt.body}
              </pre>
            </div>

            <div className="mt-8">
              <div className="flex justify-between items-center mb-4 border-b-2 border-ink pb-2">
                <h3 className="font-display text-2xl uppercase">Reviews</h3>
                {avgRating !== null && (
                  <span className="text-accent-orange font-bold">★ {avgRating.toFixed(1)} ({reviews.length})</span>
                )}
              </div>
              <div className="space-y-3">
                {reviews.length === 0 ? (
                  <p className="text-sm text-ink/60">No reviews yet. Be the first to share your thoughts!</p>
                ) : (
                  reviews.map((r, i) => (
                    <div key={i} className="bg-white border-2 border-ink p-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold uppercase text-sm">@{r.username}</span>
                        <span className="text-accent-orange text-sm">{"★".repeat(r.rating)}</span>
                      </div>
                      <p className="text-sm text-ink/80">{r.body}</p>
                    </div>
                  ))
                )}
              </div>

              {hasOwnedListing && !hasAlreadyReviewed && (
                <form onSubmit={handleSubmitReview} className="mt-6 bg-white border-4 border-ink p-5">
                  <h4 className="font-display text-xl uppercase mb-3">Leave a Review</h4>
                  <div className="flex gap-2 mb-3">
                    {[1,2,3,4,5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReviewRating(n)}
                        className={`text-2xl transition-transform hover:scale-110 ${n <= reviewRating ? "text-accent-orange" : "text-ink/20"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    rows={3}
                    placeholder="Share your experience with this prompt…"
                    className="w-full border-2 border-ink p-3 font-medium text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="mt-3 w-full bg-magenta text-white py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                  >
                    {submittingReview ? "Submitting…" : "Submit Review"}
                  </button>
                </form>
              )}
            </div>
          </div>

          <aside className="col-span-12 lg:col-span-5">
            <div className="sticky top-24">
              <div className="bg-white border-4 border-ink p-6 shadow-pop">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="bg-ink text-white text-[10px] font-bold uppercase px-2 py-1 tracking-widest">
                    {prompt.model}
                  </span>
                  <span className="bg-accent-yellow text-ink text-[10px] font-bold uppercase px-2 py-1 tracking-widest border border-ink">
                    {prompt.category}
                  </span>
                </div>
                <h1 className="font-display text-4xl uppercase leading-tight mb-3">{prompt.title}</h1>
                <p className="text-ink/70 mb-5">{prompt.description}</p>

                <div className="flex items-center gap-3 mb-5 pb-5 border-b-2 border-ink">
                  <div className="size-12 rounded-full bg-ink text-white flex items-center justify-center text-2xl border-2 border-ink">
                    {prompt.creatorEmoji}
                  </div>
                  <div>
                    <div className="font-bold uppercase text-sm">@{prompt.creator}</div>
                    <div className="text-xs text-ink/60">Creator</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-accent-orange font-bold">
                      ★ {avgRating !== null ? avgRating.toFixed(1) : (prompt.rating?.toFixed(1) || "N/A")}
                    </div>
                    <div className="text-xs text-ink/60">{reviews.length} reviews</div>
                  </div>
                </div>

                <div className="flex items-baseline justify-between mb-5">
                  <span className="font-display text-3xl text-magenta">
                    {prompt.price === 0 ? "FREE" : `$${prompt.price}`}
                  </span>
                  <button
                    onClick={handleSaveToggle}
                    aria-label={saved ? "Unsave" : "Save"}
                    className="text-2xl"
                  >
                    <motion.span
                      key={String(saved)}
                      initial={{ scale: saved ? 0.6 : 1 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 12 }}
                      className="inline-block"
                    >
                      {saved ? "❤️" : "🤍"}
                    </motion.span>
                  </button>
                </div>

                <div className="space-y-3">
                  {prompt.price === 0 ? (
                    <button
                      onClick={copy}
                      className="w-full bg-accent-orange text-white py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                    >
                      {copied ? "Copied! ✨" : "Copy & Use"}
                    </button>
                  ) : hasOwnedListing ? (
                    <button
                      onClick={copy}
                      className="w-full bg-accent-orange text-white py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                    >
                      {copied ? "Copied! ✨" : "Copy Purchased Prompt"}
                    </button>
                  ) : (
                    <button
                      onClick={handlePurchase}
                      disabled={buying || !currentUser}
                      className="w-full bg-accent-orange text-white py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                    >
                      {buying ? "Processing..." : currentUser ? `Buy for $${prompt.price}` : "Sign in to Buy"}
                    </button>
                  )}

                  <button
                    onClick={() => setModalOpen(true)}
                    className="w-full bg-white text-ink py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                  >
                    Save to Binder
                  </button>

                  {isOwner && (
                    <>
                      <button
                        onClick={handleOpenEdit}
                        className="w-full bg-holo-purple text-white py-3 font-bold uppercase border-2 border-ink text-xs shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                      >
                        Edit Listing
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="w-full bg-magenta text-white py-3 font-bold uppercase border-2 border-ink text-xs shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                      >
                        {deleting ? "Deleting..." : "Delete Listing"}
                      </button>
                    </>
                  )}

                  {!isOwner && (
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          router.navigate({ to: "/auth" });
                          return;
                        }
                        setReportModalOpen(true);
                      }}
                      className="w-full bg-white text-magenta py-3 font-bold uppercase border-2 border-magenta text-xs shadow-[3px_3px_0_0_#d400ff] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                    >
                      🚩 Report
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t-2 border-ink">
                  {prompt.tags.map((t) => (
                    <span
                      key={t}
                      className="text-xs font-bold px-2 py-1 bg-white border-2 border-ink"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-20">
          <h2 className="font-display text-3xl uppercase mb-6 border-b-4 border-ink pb-2">You might also love</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {related.map((p) => (
              <Link
                key={p.id}
                to="/prompt/$id"
                params={{ id: p.id }}
                className="block group"
              >
                <div className="border-2 border-ink overflow-hidden bg-white">
                  <img src={p.image} alt={p.title} loading="lazy" className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="mt-2 flex justify-between items-start">
                  <span className="font-bold uppercase text-sm">{p.title}</span>
                  <span className="text-magenta font-display">{p.price === 0 ? "FREE" : `$${p.price}`}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SaveToCollectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        promptTitle={prompt.title}
        listingId={prompt.id}
      />

      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        listingId={prompt.id}
        listingTitle={prompt.title}
      />

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setEditOpen(false)} />
          <div className="relative bg-white border-4 border-ink shadow-pop-lg w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b-4 border-ink bg-accent-yellow">
              <h2 className="font-display text-2xl uppercase">Edit Listing</h2>
              <button onClick={() => setEditOpen(false)} className="font-bold text-lg hover:text-magenta">✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="overflow-y-auto flex-1 p-5 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">Title</label>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required minLength={2} maxLength={80}
                  className="w-full border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">Description</label>
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} required rows={2} minLength={10} maxLength={280}
                  className="w-full border-2 border-ink p-2 font-medium text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30 resize-none" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">Prompt Body</label>
                <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} required rows={4} minLength={10} maxLength={2000}
                  className="w-full border-2 border-ink p-2 font-mono text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30 resize-none" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">Price (✦)</label>
                <input type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} min={0} max={49.99} step={0.01}
                  className="w-full border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-magenta text-white py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50">
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button type="button" onClick={() => setEditOpen(false)}
                  className="px-5 bg-white text-ink py-3 font-display uppercase border-2 border-ink hover:bg-ink hover:text-white transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
