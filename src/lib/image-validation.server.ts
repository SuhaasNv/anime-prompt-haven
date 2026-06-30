import sharp from "sharp";

// Listing cover images are normalized server-side so the database is the
// sole authority on what gets stored and rendered: every image is decoded
// (real magic-byte check, not the declared MIME), stripped of EXIF/ICC
// metadata, re-oriented, converted to sRGB, downscaled to fit WITHIN a
// 1024x768 box (aspect ratio preserved — never cropped, so portrait and
// wide uploads keep their full frame), and re-encoded as WebP. The UI
// letterboxes any ratio with a blurred backdrop, so we don't crop here.
const ALLOWED_INPUT_FORMATS = ["jpeg", "png", "webp", "gif"] as const;
const ALLOWED_INPUT_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// ~8000x5000px — generous for any legitimate upload, but blocks a tiny file
// that decompresses into a memory-exhausting bitmap.
const MAX_INPUT_PIXELS = 40_000_000;

const MIN_WIDTH = 480;
const MIN_HEIGHT = 360;

// Matches the aspect-[4/3] containers used across PromptCard and the
// listing detail page.
const OUTPUT_WIDTH = 1024;
const OUTPUT_HEIGHT = 768;
const OUTPUT_QUALITY = 82;
const OUTPUT_QUALITY_FALLBACK = 65;
const MAX_OUTPUT_BYTES = 700_000;

// Avatars are small square crops — much lower limits than listing covers.
const AVATAR_MIN_SIZE = 64;
const AVATAR_OUTPUT_SIZE = 256;
const AVATAR_OUTPUT_QUALITY = 80;
const AVATAR_OUTPUT_QUALITY_FALLBACK = 60;
const AVATAR_MAX_OUTPUT_BYTES = 150_000;

const DATA_URL_PATTERN = /^data:([a-zA-Z0-9+/.-]+);base64,(.+)$/;

const formatToMime: Record<(typeof ALLOWED_INPUT_FORMATS)[number], string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function isAllowedFormat(
  format: string | undefined,
): format is (typeof ALLOWED_INPUT_FORMATS)[number] {
  return !!format && (ALLOWED_INPUT_FORMATS as readonly string[]).includes(format);
}

/**
 * Decodes and validates an uploaded image data URL: checks the declared MIME
 * against the real magic bytes, decodes dimensions, and enforces a minimum
 * size. Shared by both the listing-cover and avatar pipelines, which differ
 * only in their minimum dimensions and output encoding.
 */
async function decodeAndValidate(
  dataUrl: string,
  minWidth: number,
  minHeight: number,
): Promise<{ buffer: Buffer; metadata: sharp.Metadata }> {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new Error("Upload a valid image file.");
  }

  const declaredMime = match[1].toLowerCase();
  const base64Payload = match[2];

  if (!ALLOWED_INPUT_MIME_TYPES.has(declaredMime)) {
    throw new Error("Unsupported image type. Upload a JPG, PNG, WEBP, or GIF.");
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Payload, "base64");
  } catch {
    throw new Error("Upload a valid image file.");
  }

  if (buffer.length < 100) {
    throw new Error("Upload a valid image file.");
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new Error("Upload a valid image file.");
  }

  if (!isAllowedFormat(metadata.format)) {
    throw new Error("Unsupported image type. Upload a JPG, PNG, WEBP, or GIF.");
  }

  if (formatToMime[metadata.format] !== declaredMime) {
    throw new Error("That file's contents don't match its type. Upload a valid image file.");
  }

  const { width, height } = metadata;
  if (!width || !height) {
    throw new Error("Upload a valid image file.");
  }

  if (width * height > MAX_INPUT_PIXELS) {
    throw new Error("Image dimensions are too large.");
  }

  if (width < minWidth || height < minHeight) {
    throw new Error(`Image is too small — please upload at least ${minWidth}x${minHeight}px.`);
  }

  return { buffer, metadata };
}

/**
 * Decodes, validates, and re-encodes an uploaded image data URL.
 * Throws a plain Error with a user-facing message on any validation failure.
 * Returns a normalized `data:image/webp;base64,...` string.
 */
export async function validateAndNormalizeImage(dataUrl: string): Promise<string> {
  const { buffer } = await decodeAndValidate(dataUrl, MIN_WIDTH, MIN_HEIGHT);

  const pipeline = () =>
    sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
      .rotate()
      .toColourspace("srgb")
      // `inside` scales the image to fit within the box while preserving its
      // aspect ratio — it never crops. `withoutEnlargement` avoids upscaling
      // (and blurring) uploads smaller than the box. Portrait/wide images keep
      // their full frame; the UI letterboxes them with a blurred backdrop.
      .resize({
        width: OUTPUT_WIDTH,
        height: OUTPUT_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      });

  let output: Buffer;
  try {
    output = await pipeline().webp({ quality: OUTPUT_QUALITY }).toBuffer();
    if (output.length > MAX_OUTPUT_BYTES) {
      output = await pipeline().webp({ quality: OUTPUT_QUALITY_FALLBACK }).toBuffer();
    }
  } catch {
    throw new Error("Couldn't process that image — try a different one.");
  }

  if (output.length > MAX_OUTPUT_BYTES) {
    throw new Error("Image is too complex to process — try a simpler image.");
  }

  return `data:image/webp;base64,${output.toString("base64")}`;
}

/**
 * Decodes, validates, and re-encodes an uploaded avatar image as a small
 * square crop. Same magic-byte/format checks as listing covers, but with
 * lower minimum dimensions and a much smaller output size.
 */
export async function validateAndNormalizeAvatar(dataUrl: string): Promise<string> {
  const { buffer } = await decodeAndValidate(dataUrl, AVATAR_MIN_SIZE, AVATAR_MIN_SIZE);

  const pipeline = () =>
    sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
      .rotate()
      .toColourspace("srgb")
      .resize({
        width: AVATAR_OUTPUT_SIZE,
        height: AVATAR_OUTPUT_SIZE,
        fit: "cover",
        position: "attention",
      });

  let output: Buffer;
  try {
    output = await pipeline().webp({ quality: AVATAR_OUTPUT_QUALITY }).toBuffer();
    if (output.length > AVATAR_MAX_OUTPUT_BYTES) {
      output = await pipeline().webp({ quality: AVATAR_OUTPUT_QUALITY_FALLBACK }).toBuffer();
    }
  } catch {
    throw new Error("Couldn't process that image — try a different one.");
  }

  if (output.length > AVATAR_MAX_OUTPUT_BYTES) {
    throw new Error("Image is too complex to process — try a simpler image.");
  }

  return `data:image/webp;base64,${output.toString("base64")}`;
}
