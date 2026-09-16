/// <reference lib="deno.ns" />

import { serveDir, } from "@std/http/file-server";

const port = Number(Deno.env.get("PORT",) ?? 3000,);

Deno.serve({ port, }, async (req,) => {
  try {
    const staticResponse = await serveDir(req, {
      fsRoot: "./build/dist",
      showDirListing: false,
      quiet: true,
    },);

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
