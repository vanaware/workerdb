/// <reference lib="deno.ns" />

import { serveDir, } from "@std/http/file-server";

const port = Number(Deno.env.get("PORT",) ?? 3000,);

Deno.serve({ port, hostname: "0.0.0.0", }, async (req,) => {
  try {
    console.log(`[REQ] ${req.method} ${req.url}`,);
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
