/// <reference lib="deno.ns" />

import { serveDir, } from "@std/http/file-server";

const rawPort = Deno.env.get("PORT",);
const port = rawPort ? Number(rawPort,) : 3000;

Deno.serve({ port, hostname: "0.0.0.0", }, async (req,) => {
  try {
    const url = new URL(req.url,);
    console.log(`[REQ] ${req.method} ${url.pathname}`,);

    const staticResponse = await serveDir(req, {
      fsRoot: "./build/dist",
      showDirListing: false,
      quiet: true,
    },);

    staticResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    staticResponse.headers.set("Pragma", "no-cache",);
    staticResponse.headers.set("Expires", "0",);

    // Permitir escopo global para Service Worker
    if (url.pathname === "/sw.js" || url.pathname.endsWith("/sw.js",)) {
      staticResponse.headers.set("Service-Worker-Allowed", "/",);
    }

    // Fallback gracioso para rotas opfs caso o Service Worker não esteja registrado (ex: preview iframe)
    if (
      (url.pathname.endsWith("/opfs",) ||
        url.pathname.includes("/opfs/",) ||
        url.pathname === "/opfs") &&
      staticResponse.status === 404
    ) {
      const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OPFS Explorer - Service Worker Required</title>
    <link href="https://cdn.jsdelivr.net/npm/beercss@3.7.12/dist/cdn/beer.min.css" rel="stylesheet">
  </head>
  <body class="dark center-align padding">
    <main class="responsive max" style="max-width: 640px; margin: 40px auto; text-align: left;">
      <article class="border yellow-container">
        <div class="row min">
          <i class="extra yellow-text">warning</i>
          <div class="max">
            <h5>Service Worker Not Active</h5>
            <p>The OPFS Explorer runs inside your browser using a Service Worker middleware.</p>
          </div>
        </div>
        <p class="margin">
          In preview or iframe environments, browser security restrictions prevent Service Workers from registering if the script is fetched through a proxy redirect (W3C Service Worker Specification).
        </p>
        <p class="margin">
          <strong>Solution:</strong> Open the application in a new browser tab outside the preview iframe, or deploy to production (e.g. GitHub Pages) where Service Workers register without proxy redirects.
        </p>
        <div class="space"></div>
        <nav class="right-align">
          <a href="../" class="button transparent">
            <i>arrow_back</i> Back to App
          </a>
          <a href="../" target="_blank" class="button primary">
            <i>open_in_new</i> Open App in New Tab
          </a>
        </nav>
      </article>
    </main>
  </body>
</html>`;
      return new Response(html, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      },);
    }

    return staticResponse;
  } catch (err) {
    console.warn(
      `[STATIC] Falha ao servir arquivo estático. Build ainda não foi executado?`,
      err instanceof Error ? err.message : err,
    );

    return new Response("Internal Server Error", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8", },
    },);
  }
},);
