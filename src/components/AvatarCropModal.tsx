import { useRef, useState, type PointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FRAME_SIZE = 256;
const OUTPUT_SIZE = 512;
const MAX_ZOOM = 3;

interface AvatarCropModalProps {
  imageSrc: string;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (croppedDataUrl: string) => void;
}

/**
 * Lets the user pan/zoom an uploaded photo within a circular frame before
 * it's saved as their avatar. The exported crop is always a square image —
 * the server-side normalization pipeline only resizes a square input, so
 * the framing chosen here is preserved.
 */
export function AvatarCropModal({ imageSrc, saving, error, onCancel, onConfirm }: AvatarCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const baseScale = natural ? Math.max(FRAME_SIZE / natural.w, FRAME_SIZE / natural.h) : 1;
  const displayScale = baseScale * zoom;
  const displayedW = natural ? natural.w * displayScale : FRAME_SIZE;
  const displayedH = natural ? natural.h * displayScale : FRAME_SIZE;

  const clamp = (next: { x: number; y: number }, w: number, h: number) => ({
    x: Math.min(0, Math.max(FRAME_SIZE - w, next.x)),
    y: Math.min(0, Math.max(FRAME_SIZE - h, next.y)),
  });

  const handleImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const scale = Math.max(FRAME_SIZE / w, FRAME_SIZE / h);
    setNatural({ w, h });
    setZoom(1);
    setPos({ x: (FRAME_SIZE - w * scale) / 2, y: (FRAME_SIZE - h * scale) / 2 });
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
    setPos(clamp({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }, displayedW, displayedH));
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || !natural) return;

    const sourceSize = FRAME_SIZE / displayScale;
    const sourceX = -pos.x / displayScale;
    const sourceY = -pos.y / displayScale;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    onConfirm(canvas.toDataURL("image/png"));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-ink/60 backdrop-blur-sm flex items-center justify-center p-6"
        onClick={() => !saving && onCancel()}
      >
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white border-4 border-ink shadow-pop-lg w-full max-w-sm p-6"
        >
          <div className="flex justify-between items-start mb-4 border-b-2 border-ink pb-3">
            <h2 className="font-display text-2xl uppercase leading-tight">Position Photo</h2>
            <button
              onClick={onCancel}
              disabled={saving}
              className="size-8 bg-accent-yellow border-2 border-ink font-bold hover:bg-accent-orange transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div
            className="relative size-64 mx-auto overflow-hidden rounded-full border-4 border-ink bg-ink/5 cursor-grab active:cursor-grabbing touch-none select-none"
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
          </div>

          <p className="text-xs text-ink/50 text-center mt-3">Drag to reposition, then save.</p>

          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs font-bold uppercase">Zoom</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="flex-1"
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
              {saving ? "Saving…" : "Save"}
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
