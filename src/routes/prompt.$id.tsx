import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type ClipboardEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { confirm } from "@/components/ui/confirm-dialog";
import { SaveToCollectionModal } from "@/components/SaveToCollectionModal";
import { ReportModal } from "@/components/ReportModal";
import { PurchaseModal } from "@/components/PurchaseModal";
import {
  getListing,
  incrementViewCount,
  deleteListing,
  updateListing,
  MAX_PRICE,
} from "@/lib/api/listings.functions";
import { getPrompt, PROMPTS, type Prompt } from "@/lib/mock-data";
import { handleImageError } from "@/lib/utils";
import { CURRENT_USER_QUERY_KEY, getCurrentUser } from "@/lib/api/auth.functions";
import { isSaved, savePrompt, unsavePrompt } from "@/lib/api/saves.functions";
import { listCollections } from "@/lib/api/collections.functions";
import { hasPurchased } from "@/lib/api/purchases.functions";
import {
  listReviews,
  getAverageRating,
  hasUserReviewed,
  createReview,
  deleteReview,
  replyToReview,
} from "@/lib/api/reviews.functions";
import { CREDITS_QUERY_KEY, getMyCredits } from "@/lib/api/credits.functions";
import { recordCopy } from "@/lib/api/copies.functions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/prompt/$id")({
  loader: async ({ params, context }) => {
    // Validate UUID format early to show 404 instead of generic error for malformed IDs
    if (!UUID_RE.test(params.id)) throw notFound();

    const prompt = getPrompt(params.id) ?? (await getListing({ data: { id: params.id } }));
    if (!prompt) throw notFound();

    // Prefetch the session into the shared QueryClient so the "Manage Prompt"
    // vs "Buy" decision below is correct on first render — avoids a flash of
    // the signed-out/buyer state while a client-side fetch resolves.
    const user = await context.queryClient.ensureQueryData({
      queryKey: CURRENT_USER_QUERY_KEY,
      queryFn: getCurrentUser,
      staleTime: 60_000,
    });

    // Removed/hidden listings are only viewable by their creator or an admin —
    // everyone else gets the same 404 as a deleted prompt. Exception: buyers
    // who already purchased a now-hidden listing keep access to what they paid for.
    if (prompt.status && prompt.status !== "published") {
      let canView = !!user && (user.id === prompt.userId || user.is_admin);
      if (!canView && user && prompt.status === "hidden") {
        const purchased = await hasPurchased({ data: { listingId: prompt.id } });
        canView = purchased.purchased;
      }
      if (!canView) throw notFound();
    }

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
        <Link to="/" className="mt-4 inline-block underline font-bold">
          Back to market
        </Link>
      </div>
    </div>
  ),
  errorComponent: () => <div className="p-10">Something glitched.</div>,
});

interface Review {
  userId: string;
  username: string;
  rating: number;
  body: string;
  createdAt: string;
  creatorReply: string | null;
  creatorReplyAt: string | null;
}

function PromptDetail() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { prompt } = Route.useLoaderData() as { prompt: Prompt };
  const [modalOpen, setModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const { data: currentUser } = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
    staleTime: 60_000,
  });
  const { data: collections = [] } = useQuery({
    queryKey: ["collections"],
    queryFn: listCollections,
    enabled: !!currentUser,
  });
  const inAnyCollection = collections.some((c) => c.promptIds.includes(prompt.id));
  const [userCredits, setUserCredits] = useState(0);
  const [hasOwnedListing, setHasOwnedListing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editPrice, setEditPrice] = useState("0");
  const [saving, setSaving] = useState(false);
  const [hasAlreadyReviewed, setHasAlreadyReviewed] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [deletingReview, setDeletingReview] = useState(false);
  const [confirmingDeleteReview, setConfirmingDeleteReview] = useState(false);
  const [replyingUserId, setReplyingUserId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

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
      } catch (err) {
        console.error("Failed to load prompt details", err);
      }
    };
    loadData();
  }, [prompt.id]);

  // Load signed-in-user-specific data once the session resolves
  useEffect(() => {
    if (!currentUser) return;
    const loadUserData = async () => {
      try {
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
      } catch (err) {
        console.error("Failed to load user prompt details", err);
      }
    };
    loadUserData();
  }, [currentUser, prompt.id]);

  const copy = () => {
    if (!currentUser) {
      toast.error("Sign in to copy this prompt.");
      router.navigate({ to: "/auth" });
      return;
    }
    navigator.clipboard.writeText(prompt.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    // Fire-and-forget: awards author their copy commission
    if (prompt.id) {
      recordCopy({ data: { listingId: prompt.id } }).catch(() => {});
    }
  };

  const blockCopyIfSignedOut = (e: ClipboardEvent<HTMLPreElement>) => {
    if (!currentUser) {
      e.preventDefault();
      toast.error("Sign in to copy this prompt.");
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

  const handlePurchaseSuccess = (newBalance: number) => {
    setUserCredits(newBalance);
    queryClient.setQueryData(CREDITS_QUERY_KEY, { balance: newBalance });
    setHasOwnedListing(true);
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete listing?",
      description: "Are you sure you want to delete this listing?",
      confirmText: "Delete",
      destructive: true,
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteListing({ data: { id: prompt.id } });
      await router.navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenEdit = () => {
    setEditTitle(prompt.title);
    setEditDescription(prompt.description);
    setEditBody(prompt.body);
    setEditPrice(String(prompt.price));
    setEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedPrice = Number(editPrice);
    if (!Number.isInteger(parsedPrice) || parsedPrice < 0 || parsedPrice > MAX_PRICE) {
      toast.error(`Price must be a whole number between 0 and ${MAX_PRICE} ✦.`);
      return;
    }

    setSaving(true);
    try {
      await updateListing({
        data: {
          id: prompt.id,
          title: editTitle,
          description: editDescription,
          body: editBody,
          price: parsedPrice,
        },
      });
      await router.invalidate();
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      await createReview({
        data: { listingId: prompt.id, rating: reviewRating, body: reviewBody },
      });
      const [reviewsList, rating] = await Promise.all([
        listReviews({ data: { listingId: prompt.id } }),
        getAverageRating({ data: { listingId: prompt.id } }),
      ]);
      setReviews(reviewsList as Review[]);
      setAvgRating(rating.average);
      setHasAlreadyReviewed(true);
      setIsEditingReview(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleEditReview = (review: Review) => {
    setReviewRating(review.rating);
    setReviewBody(review.body ?? "");
    setIsEditingReview(true);
    setConfirmingDeleteReview(false);
  };

  const handleCancelEditReview = () => {
    setIsEditingReview(false);
    setReviewRating(5);
    setReviewBody("");
  };

  const handleDeleteReview = async () => {
    setDeletingReview(true);
    try {
      await deleteReview({ data: { listingId: prompt.id } });
      const [reviewsList, rating] = await Promise.all([
        listReviews({ data: { listingId: prompt.id } }),
        getAverageRating({ data: { listingId: prompt.id } }),
      ]);
      setReviews(reviewsList as Review[]);
      setAvgRating(rating.average);
      setHasAlreadyReviewed(false);
      setIsEditingReview(false);
      setReviewRating(5);
      setReviewBody("");
      setConfirmingDeleteReview(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete review");
    } finally {
      setDeletingReview(false);
    }
  };

  const handleStartReply = (reviewUserId: string, existingReply: string | null) => {
    setReplyingUserId(reviewUserId);
    setReplyText(existingReply ?? "");
  };

  const handleCancelReply = () => {
    setReplyingUserId(null);
    setReplyText("");
  };

  const handleSubmitReply = async (reviewUserId: string) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      await replyToReview({
        data: { listingId: prompt.id, reviewUserId, reply: replyText.trim() },
      });
      const reviewsList = await listReviews({ data: { listingId: prompt.id } });
      setReviews(reviewsList as Review[]);
      setReplyingUserId(null);
      setReplyText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit reply");
    } finally {
      setSubmittingReply(false);
    }
  };

  const isOwner = !!currentUser && currentUser.id === prompt.userId;

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
                onError={handleImageError}
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
              <pre
                className={`font-mono text-sm whitespace-pre-wrap leading-relaxed text-white/90 ${
                  currentUser ? "" : "select-none"
                }`}
                onCopy={blockCopyIfSignedOut}
              >
                {prompt.body}
              </pre>
              {!currentUser && (
                <p className="mt-3 text-xs font-bold uppercase tracking-widest text-accent-yellow">
                  Sign in to copy this prompt.
                </p>
              )}
            </div>

            <div className="mt-8">
              <div className="flex justify-between items-center mb-4 border-b-2 border-ink pb-2">
                <h3 className="font-display text-2xl uppercase">Reviews</h3>
                {avgRating !== null && (
                  <span className="text-accent-orange font-bold">
                    ★ {avgRating.toFixed(1)} ({reviews.length})
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {reviews.length === 0 ? (
                  <p className="text-sm text-ink/60">
                    No reviews yet. Be the first to share your thoughts!
                  </p>
                ) : (
                  reviews.map((r, i) => {
                    const isMine = currentUser && r.userId === currentUser.id;
                    return (
                      <div key={i} className="bg-white border-2 border-ink p-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold uppercase text-sm">@{r.username}</span>
                          <span className="text-accent-orange text-sm">{"★".repeat(r.rating)}</span>
                        </div>
                        <p className="text-sm text-ink/80">{r.body}</p>
                        {isMine &&
                          (confirmingDeleteReview ? (
                            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-ink/10">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-ink/60">
                                Delete this review?
                              </span>
                              <button
                                type="button"
                                onClick={handleDeleteReview}
                                disabled={deletingReview}
                                className="text-[10px] font-bold uppercase tracking-widest text-magenta hover:underline disabled:opacity-50"
                              >
                                {deletingReview ? "Deleting…" : "Yes, delete"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingDeleteReview(false)}
                                disabled={deletingReview}
                                className="text-[10px] font-bold uppercase tracking-widest text-ink/50 hover:text-ink transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-3 mt-2 pt-2 border-t border-ink/10">
                              <button
                                type="button"
                                onClick={() => handleEditReview(r)}
                                className="text-[10px] font-bold uppercase tracking-widest text-ink/50 hover:text-magenta transition-colors"
                              >
                                ✎ Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingDeleteReview(true)}
                                className="text-[10px] font-bold uppercase tracking-widest text-ink/50 hover:text-magenta transition-colors"
                              >
                                🗑 Delete
                              </button>
                            </div>
                          ))}

                        {r.creatorReply && replyingUserId !== r.userId && (
                          <div className="mt-2 pt-2 border-t border-ink/10">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-magenta">
                              Creator's reply
                            </span>
                            <p className="text-sm text-ink/80 mt-1">{r.creatorReply}</p>
                          </div>
                        )}

                        {isOwner &&
                          (replyingUserId === r.userId ? (
                            <div className="mt-2 pt-2 border-t border-ink/10">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                rows={2}
                                maxLength={500}
                                placeholder="Reply to this review…"
                                className="w-full border-2 border-ink p-2 font-medium text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30 resize-none"
                              />
                              <div className="flex gap-3 mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleSubmitReply(r.userId)}
                                  disabled={submittingReply || !replyText.trim()}
                                  className="text-[10px] font-bold uppercase tracking-widest text-magenta hover:underline disabled:opacity-50"
                                >
                                  {submittingReply ? "Saving…" : "Save Reply"}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelReply}
                                  disabled={submittingReply}
                                  className="text-[10px] font-bold uppercase tracking-widest text-ink/50 hover:text-ink transition-colors disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 pt-2 border-t border-ink/10">
                              <button
                                type="button"
                                onClick={() => handleStartReply(r.userId, r.creatorReply)}
                                className="text-[10px] font-bold uppercase tracking-widest text-ink/50 hover:text-magenta transition-colors"
                              >
                                {r.creatorReply ? "✎ Edit Reply" : "↩ Reply"}
                              </button>
                            </div>
                          ))}
                      </div>
                    );
                  })
                )}
              </div>

              {hasOwnedListing && (!hasAlreadyReviewed || isEditingReview) && (
                <form
                  onSubmit={handleSubmitReview}
                  className="mt-6 bg-white border-4 border-ink p-5"
                >
                  <h4 className="font-display text-xl uppercase mb-3">
                    {isEditingReview ? "Edit Your Review" : "Leave a Review"}
                  </h4>
                  <div className="flex gap-2 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => (
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
                  <div className="flex gap-2 mt-3">
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="flex-1 bg-magenta text-white py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                    >
                      {submittingReview
                        ? "Submitting…"
                        : isEditingReview
                          ? "Update Review"
                          : "Submit Review"}
                    </button>
                    {isEditingReview && (
                      <button
                        type="button"
                        onClick={handleCancelEditReview}
                        disabled={submittingReview}
                        className="px-5 bg-white text-ink py-3 font-display uppercase border-2 border-ink hover:bg-ink hover:text-white transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
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
                <h1 className="font-display text-4xl uppercase leading-tight mb-3">
                  {prompt.title}
                </h1>
                <p className="text-ink/70 mb-5">{prompt.description}</p>

                <div className="flex items-center gap-3 mb-5 pb-5 border-b-2 border-ink">
                  <div className="size-12 rounded-full bg-ink text-white flex items-center justify-center text-2xl border-2 border-ink overflow-hidden">
                    {prompt.creatorAvatarUrl ? (
                      <img src={prompt.creatorAvatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      prompt.creatorEmoji
                    )}
                  </div>
                  <div>
                    <div className="font-bold uppercase text-sm">@{prompt.creator}</div>
                    <div className="text-xs text-ink/60">Creator</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-accent-orange font-bold">
                      ★{" "}
                      {avgRating !== null
                        ? avgRating.toFixed(1)
                        : prompt.rating?.toFixed(1) || "N/A"}
                    </div>
                    <div className="text-xs text-ink/60">{reviews.length} reviews</div>
                  </div>
                </div>

                <div className="flex items-baseline justify-between mb-5">
                  <span className="font-display text-3xl text-magenta">
                    {prompt.price === 0 ? "FREE" : `${prompt.price} ✦`}
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
                  {isOwner ? (
                    <button
                      onClick={() => setManageModalOpen(true)}
                      className="w-full bg-holo-purple text-white py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                    >
                      Manage Prompt
                    </button>
                  ) : prompt.price === 0 ? (
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
                      onClick={() => {
                        if (!currentUser) {
                          router.navigate({ to: "/auth" });
                          return;
                        }
                        setPurchaseModalOpen(true);
                      }}
                      className="w-full bg-accent-orange text-white py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                    >
                      {currentUser ? `Buy for ${prompt.price} ✦` : "Sign in to Buy"}
                    </button>
                  )}

                  <button
                    onClick={() => setModalOpen(true)}
                    className={`w-full py-4 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all ${
                      inAnyCollection ? "bg-accent-yellow text-ink" : "bg-white text-ink"
                    }`}
                  >
                    {inAnyCollection ? "✓ Saved to Binder" : "Save to Binder"}
                  </button>
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

                {!isOwner && (
                  <div className="mt-4 pt-4 border-t border-ink/10 text-center">
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          router.navigate({ to: "/auth" });
                          return;
                        }
                        setReportModalOpen(true);
                      }}
                      className="text-[10px] font-bold uppercase tracking-widest text-ink/40 hover:text-magenta transition-colors"
                    >
                      🚩 Report this listing
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-20">
          <h2 className="font-display text-3xl uppercase mb-6 border-b-4 border-ink pb-2">
            You might also love
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {related.map((p) => (
              <Link key={p.id} to="/prompt/$id" params={{ id: p.id }} className="block group">
                <div className="border-2 border-ink overflow-hidden bg-white">
                  <img
                    src={p.image}
                    alt={p.title}
                    loading="lazy"
                    className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={handleImageError}
                  />
                </div>
                <div className="mt-2 flex justify-between items-start">
                  <span className="font-bold uppercase text-sm">{p.title}</span>
                  <span className="text-magenta font-display">
                    {p.price === 0 ? "FREE" : `${p.price} ✦`}
                  </span>
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

      <PurchaseModal
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        listingId={prompt.id}
        title={prompt.title}
        price={prompt.price}
        userCredits={userCredits}
        onSuccess={handlePurchaseSuccess}
      />

      {manageModalOpen && isOwner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-ink/60" onClick={() => setManageModalOpen(false)} />
          <div className="relative bg-white border-4 border-ink shadow-pop-lg w-full max-w-sm">
            <div className="p-6 border-b-4 border-ink bg-holo-purple">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl uppercase text-white">Manage Prompt</h2>
                <button
                  onClick={() => setManageModalOpen(false)}
                  className="text-white text-2xl font-bold hover:opacity-70"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-bold block text-xs uppercase text-ink/70">Views</span>
                  <span className="text-2xl font-bold text-holo-purple">{prompt.viewCount || 0}</span>
                </div>
                <div>
                  <span className="font-bold block text-xs uppercase text-ink/70">Price</span>
                  <span className="text-2xl font-bold text-magenta">{prompt.price} ✦</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setManageModalOpen(false);
                    handleOpenEdit();
                  }}
                  className="w-full bg-holo-purple text-white py-3 font-bold uppercase border-2 border-ink shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-sm"
                >
                  Edit Listing
                </button>
                <button
                  onClick={() => {
                    setManageModalOpen(false);
                    handleDelete();
                  }}
                  disabled={deleting}
                  className="w-full bg-magenta text-white py-3 font-bold uppercase border-2 border-ink shadow-[3px_3px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 text-sm"
                >
                  {deleting ? "Deleting..." : "Delete Listing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-ink/60" onClick={() => setEditOpen(false)} />
          <div className="relative bg-white border-4 border-ink shadow-pop-lg w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b-4 border-ink bg-accent-yellow">
              <h2 className="font-display text-2xl uppercase">Edit Listing</h2>
              <button
                onClick={() => setEditOpen(false)}
                className="font-bold text-lg hover:text-magenta"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="overflow-y-auto flex-1 p-5 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">
                  Title
                </label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  className="w-full border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  required
                  rows={2}
                  minLength={10}
                  maxLength={280}
                  className="w-full border-2 border-ink p-2 font-medium text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">
                  Prompt Body
                </label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  required
                  rows={4}
                  minLength={10}
                  maxLength={2000}
                  className="w-full border-2 border-ink p-2 font-mono text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">
                  Price (✦, 0–{MAX_PRICE})
                </label>
                <input
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  min={0}
                  max={MAX_PRICE}
                  step={1}
                  className="w-full border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-magenta text-white py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="px-5 bg-white text-ink py-3 font-display uppercase border-2 border-ink hover:bg-ink hover:text-white transition-colors"
                >
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
