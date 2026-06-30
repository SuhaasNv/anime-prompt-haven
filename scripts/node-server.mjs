// Production Node listener for the Vite-SSR build (vite.config.ts has nitro: false).
//
// The build emits a Web `fetch(request, env, ctx)` handler at dist/server/server.js
// (our src/server.ts wrapper around TanStack Start) plus static client assets in
// dist/client. This server:
//   1. Serves files from dist/client (hashed assets get long-lived immutable cache).
//   2. Pipes every other request to the fetch handler (SSR + server functions).
//
// We run this instead of Nitro's node-server preset because that preset inlines
// node_modules and breaks jsdom/css-tree runtime file reads (see vite.config.ts).
// Deps stay external here, so real node_modules must be present at runtime.

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, normalize, extname } from "node:path";
import { Readable } from "node:stream";

const distDir = fileURLToPath(new URL("../dist/", import.meta.url));
const clientDir = join(distDir, "client");
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || "0.0.0.0";

const { default: handler } = await import(new URL("../dist/server/server.js", import.meta.url).href);

const MIME = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** Resolve a request path to a real file inside dist/client, or null. */
async function resolveStatic(urlPath) {
  // Strip query, decode, normalize, and reject path traversal.
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  if (pathname.endsWith("/")) return null; // directories -> let SSR handle "/"
  const rel = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(clientDir, rel);
  if (!filePath.startsWith(clientDir)) return null;
  try {
    const s = await stat(filePath);
    if (s.isFile()) return { filePath, size: s.size };
  } catch {
    /* not a file */
  }
  return null;
}

function sendStatic(req, res, { filePath, size }) {
  const ext = extname(filePath).toLowerCase();
  res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
  res.setHeader("Content-Length", size);
  // Vite emits content-hashed filenames under /assets — safe to cache forever.
  if (filePath.includes(`${join(clientDir, "assets")}`)) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  } else {
    res.setHeader("Cache-Control", "public, max-age=3600");
  }
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

/** Build a Web Request from a Node IncomingMessage. */
function toWebRequest(req) {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const url = `${proto}://${req.headers.host ?? "localhost"}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
    else if (v != null) headers.set(k, v);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

/** Write a Web Response to a Node ServerResponse. */
async function sendWebResponse(res, webRes) {
  res.statusCode = webRes.status;
  // Headers.forEach folds multiple Set-Cookie into one comma-joined value, which
  // corrupts cookies (Expires dates contain commas). Emit them as separate headers.
  const setCookies =
    typeof webRes.headers.getSetCookie === "function" ? webRes.headers.getSetCookie() : [];
  webRes.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (setCookies.length > 0) res.setHeader("Set-Cookie", setCookies);
  if (webRes.body) {
    Readable.fromWeb(webRes.body).pipe(res);
  } else {
    res.end(await webRes.text());
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" || req.method === "HEAD") {
      const hit = await resolveStatic(req.url);
      if (hit) {
        sendStatic(req, res, hit);
        return;
      }
    }
    const webRes = await handler.fetch(toWebRequest(req), {}, {});
    await sendWebResponse(res, webRes);
  } catch (err) {
    console.error("[node-server] request failed:", err);
    if (!res.headersSent) res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`PromptStar listening on http://${host}:${port}/`);
});
