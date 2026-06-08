import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "@tanstack/react-router";

import { createListing } from "@/lib/api/listings.functions";
import { CATEGORIES, MODELS } from "@/lib/mock-data";

const LISTING_CATEGORIES = CATEGORIES.filter((c) => c !== "All");
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

interface ContributeModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContributeModal({ open, onClose }: ContributeModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [price, setPrice] = useState("0");
  const [category, setCategory] = useState(LISTING_CATEGORIES[0]);
  const [model, setModel] = useState(MODELS[0]);
  const [tagsInput, setTagsInput] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setDescription("");
    setBody("");
    setPrice("0");
    setCategory(LISTING_CATEGORIES[0]);
    setModel(MODELS[0]);
    setTagsInput("");
    setImageDataUrl(null);
    setImageName(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageDataUrl(null);
      setImageName(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image — pick a JPG, PNG, WEBP, or GIF.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is too large — keep it under 4MB.");
      e.target.value = "";
      return;
    }
    setError(null);
    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImageDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!imageDataUrl) {
      setError("An image is required to list a prompt on the market.");
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);

    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Price must be a number, 0 or higher.");
      return;
    }

    setSubmitting(true);
    try {
      await createListing({
        data: {
          title,
          description,
          body,
          image: imageDataUrl,
          price: parsedPrice,
          category,
          model: model as (typeof MODELS)[number],
          tags,
        },
      });
      await router.invalidate();
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't list that prompt — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-y-auto"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-4 border-ink shadow-pop-lg w-full max-w-lg p-6 my-8"
          >
            <div className="flex justify-between items-start mb-4 border-b-2 border-ink pb-3">
              <div>
                <h2 className="font-display text-2xl uppercase leading-tight">Contribute a Prompt</h2>
                <p className="text-xs text-ink/60 mt-1">List your creation on the market for other creators.</p>
              </div>
              <button
                onClick={handleClose}
                className="size-8 bg-accent-yellow border-2 border-ink font-bold hover:bg-accent-orange transition-colors shrink-0"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">
                  Cover image <span className="text-magenta">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  required
                  onChange={handleImageChange}
                  className="hidden"
                  id="contribute-image"
                />
                <label
                  htmlFor="contribute-image"
                  className="flex items-center gap-3 border-2 border-dashed border-ink p-3 cursor-pointer hover:border-magenta hover:text-magenta transition-colors"
                >
                  {imageDataUrl ? (
                    <img src={imageDataUrl} alt="Preview" className="size-16 object-cover border-2 border-ink shrink-0" />
                  ) : (
                    <span className="size-16 border-2 border-ink flex items-center justify-center text-2xl shrink-0 bg-secondary">🖼️</span>
                  )}
                  <span className="text-sm font-bold uppercase truncate">
                    {imageName ?? "Click to upload an image — required"}
                  </span>
                </label>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">Title</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Golden Hour Product Shot"
                  className="w-full bg-white border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">Description</label>
                <textarea
                  required
                  minLength={10}
                  maxLength={280}
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Studio product photography with soft golden-hour lighting and a glossy reflective surface."
                  className="w-full bg-white border-2 border-ink p-2 font-medium text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">Prompt body</label>
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="product on a marble pedestal, soft golden-hour rim light, glossy reflections, shallow depth of field…"
                  className="w-full bg-white border-2 border-ink p-2 font-mono text-xs focus:outline-none focus:ring-4 focus:ring-magenta/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest block mb-1">Price (USD)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={999}
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-white border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest block mb-1">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-white border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
                  >
                    {MODELS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
                >
                  {LISTING_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest block mb-1">Tags (comma-separated, up to 6)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="cyberpunk, neon, urban"
                  className="w-full bg-white border-2 border-ink p-2 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-magenta/30"
                />
              </div>

              {error && <p className="text-xs font-bold text-magenta">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-accent-orange text-white py-3 font-display uppercase border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                >
                  {submitting ? "Listing…" : "List on Market"}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 bg-white text-ink py-3 font-display uppercase border-2 border-ink hover:bg-ink hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
