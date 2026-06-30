import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  type PointerEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

// Output matches the marketplace's 4:3 cover slot. The server's image
// pipeline uses fit:"inside", so a 4:3 input is stored unchanged — the
// framing chosen here is exactly what appears on the card.
const OUTPUT_W = 1024;
const OUTPUT_H = 768;
const MAX_ZOOM = 4;

interface CoverCropModalProps {
  imageSrc: string;
  saving?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}

/**
 * Lets the creator pan/zoom an uploaded image inside a fixed 4:3 frame before
 * it becomes the listing cover, so they control the crop instead of the server
 * guessing. The frame width tracks its container (responsive); the image is
 * always at least "cover" size so the 4:3 crop can never include empty gaps.
 * The exported image is a 1024×768 JPEG — exactly the marketplace ratio.
 */
export function CoverCropModal({
  imageSrc,
  saving = false,
  error = null,
  onCancel,
  onConfirm,
}: CoverCropModalProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );
  const [frame, setFrame] = useState({ w: 320, h: 240 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const baseScale = natural ? Math.max(frame.w / natural.w, frame.h / natural.h) : 1;
  const displayScale = baseScale * zoom;
  const displayedW = natural ? natural.w * displayScale : frame.w;
  const displayedH = natural ? natural.h * displayScale : frame.h;

  const clamp = useCallback(
    (next: { x: number; y: number }, w: number, h: number) => ({
      x: Math.min(0, Math.max(frame.w - w, next.x)),
      y: Math.min(0, Math.max(frame.h - h, next.y)),
    }),
    [frame.w, frame.h],
  );

  // The frame fills its container's width and derives a 4:3 height, so the
  // crop area is large on desktop and still fits a 375px phone.
  useLayoutEffect(() => {
    const measure = () => {
      const el = frameRef.current;
      if (!el) return;
      const w = el.clientWidth;
      if (w > 0) setFrame({ w, h: Math.round((w * 3) / 4) });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Center the image whenever the source or frame size changes (e.g. on load
  // or device rotation), resetting zoom so the framing starts predictably.
  useEffect(() => {
    if (!natural) return;
    const scale = Math.max(frame.w / natural.w, frame.h / natural.h);
    setZoom(1);
    setPos({ x: (frame.w - natural.w * scale) / 2, y: (frame.h - natural.h * scale) / 2 });
  }, [natural, frame.w, frame.h]);

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const handleZoomChange = (next: number) => {
    setZoom(next);
    if (!natural) return;
    const scale = baseScale * next;
    setPos((p) => clamp(p, natural.w * scale, natural.h * scale));
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!natural) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(
      clamp(
        { x: dragRef.current.origX + dx, y: dragRef.current.origY + dy },
        displayedW,
        displayedH,
      ),
    );
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || !natural) return;

    const sourceW = frame.w / displayScale;
    const sourceH = frame.h / displayScale;
    const sourceX = -pos.x / displayScale;
    const sourceY = -pos.y / displayScale;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, OUTPUT_W, OUTPUT_H);
    onConfirm(canvas.toDataURL("image/jpeg", 0.92));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[210] bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-6"
        onClick={() => !saving && onCancel()}
        role="dialog"
        aria-modal="true"
        aria-label="Crop cover image"
      >
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white border-4 border-ink shadow-pop-lg w-full max-w-lg p-6"
        >
          <div className="flex justify-between items-start mb-4 border-b-2 border-ink pb-3">
            <div>
              <h2 className="font-display text-2xl uppercase leading-tight">Crop to 4:3</h2>
              <p className="text-xs text-ink/60 mt-1">
                Drag to reposition, zoom to taste. This is exactly how your card will look.
              </p>
            </div>
            <button
              onClick={onCancel}
              disabled={saving}
              className="size-8 bg-accent-yellow border-2 border-ink font-bold hover:bg-accent-orange transition-colors disabled:opacity-50 shrink-0"
              aria-label="Cancel crop"
            >
              ×
            </button>
          </div>

          <div
            ref={frameRef}
            className="relative w-full overflow-hidden border-4 border-ink bg-ink cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ height: frame.h }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt=""
              onLoad={handleImgLoad}
              draggable={false}
              className="absolute pointer-events-none max-w-none"
              style={{ width: displayedW, height: displayedH, left: pos.x, top: pos.y }}
            />
            {/* Rule-of-thirds guide — purely visual, never intercepts drags. */}
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/30" />
              <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/30" />
              <div className="absolute left-0 right-0 top-1/3 h-px bg-white/30" />
              <div className="absolute left-0 right-0 top-2/3 h-px bg-white/30" />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <span className="text-xs font-bold uppercase">Zoom</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              aria-label="Zoom"
              className="flex-1 accent-magenta cursor-pointer"
            />
          </div>

          {error && (
            <div className="mt-4 p-3 bg-magenta/10 border-2 border-magenta text-magenta text-sm font-bold">
              {error}
            </div>
          )}

          <div className="flex gap-2 mt-5">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || !natural}
              className="flex-1 bg-accent-orange text-white py-3 font-display uppercase tracking-wide border-2 border-ink shadow-[4px_4px_0_0_#0a0a0c] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-40"
            >
              {saving ? "Saving…" : "Use This Crop"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-5 bg-white text-ink py-3 font-display uppercase border-2 border-ink hover:bg-ink hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
