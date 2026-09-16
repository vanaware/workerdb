// ## Arquivo: monorepo/worker-db/example/sw.ts
/// <reference lib="webworker" />

import { dbsw as db, } from "@workerdb/workerdb";
import {
  getFileFromOpfs,
  listOpfsFiles,
} from "../../worker-db/src/utils/opfs.ts";

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", (event,) => {
  sw.skipWaiting();
},);

sw.addEventListener("activate", (event,) => {
  event.waitUntil(sw.clients.claim(),);
},);

sw.addEventListener("fetch", (event,) => {
  const url = new URL(event.request.url,);
  const match = url.pathname.match(/\/opfs(?:$|\/(.*))/,);

  if (match) {
    event.respondWith((async () => {
      // If there's no trailing slash, redirect to add it
      if (url.pathname.endsWith("/opfs",)) {
        return Response.redirect(url.href + "/", 301,);
      }

      const filePath = match[1] || "";

      if (filePath === "" || filePath.endsWith("/",)) {
        try {
          const files = await listOpfsFiles();
          let html =
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OPFS Explorer</title>
          <style>body { font-family: system-ui; padding: 24px; background: #1a1c19; color: #e2e3dd; } a { color: #9edeb6; text-decoration: none; } a:hover { text-decoration: underline; } ul { list-style-type: none; padding: 0; } li { padding: 8px 0; border-bottom: 1px solid #2d312d; }</style>
          </head><body><h1>📁 OPFS Explorer</h1><ul>`;

          if (filePath !== "") {
            html += `<li><a href="../">🔙 ../</a></li>`;
          }

          const currentDir = filePath;
          const entries = new Set<string>();

          for (const f of files) {
            if (f.startsWith(currentDir,)) {
              const remainder = f.slice(currentDir.length,);
              const slashIdx = remainder.indexOf("/",);
              if (slashIdx === -1) {
                entries.add(remainder,);
              } else {
                entries.add(remainder.slice(0, slashIdx + 1,),);
              }
            }
          }

          for (const entry of Array.from(entries,).sort()) {
            const isDir = entry.endsWith("/",);
            const icon = isDir ? "📁" : "📄";
            html += `<li><a href="${entry}">${icon} ${entry}</a></li>`;
          }

          html += `</ul></body></html>`;

          return new Response(html, {
            headers: { "Content-Type": "text/html", },
          },);
        } catch (err) {
          return new Response(
            `Erro ao listar OPFS: ${(err as Error).message}`,
            { status: 500, },
          );
        }
      } else {
        try {
          const decodedPath = decodeURIComponent(filePath,);
          const file = await getFileFromOpfs(decodedPath,);

          let contentType = "application/octet-stream";
          if (decodedPath.endsWith(".json",)) contentType = "application/json";
          else if (
            decodedPath.endsWith(".txt",) || decodedPath.endsWith(".md",)
          ) contentType = "text/plain";
          else if (decodedPath.endsWith(".html",)) contentType = "text/html";
          else if (decodedPath.endsWith(".png",)) contentType = "image/png";

          return new Response(file, {
            headers: { "Content-Type": contentType, },
          },);
        } catch (err) {
          return new Response(
            `Arquivo não encontrado: ${decodeURIComponent(filePath,)}\n\n${
              (err as Error).message
            }`,
            { status: 404, },
          );
        }
      }
    })(),);
  }
},);

sw.addEventListener("message", async (event,) => {
  if (event.data && event.data.type === "RUN_SW_DEMO") {
    try {
      const msgStore = db("SYNTAXMESH_DATA", "messages", "MSG_",);

      const insertedId = await msgStore.set("auto", {
        senderId: "system_sw",
        recipientId: "all",
        content: "Mensagem gravada diretamente pelo Service Worker!",
        status: "delivered",
        priority: 99,
        timestamp: Date.now(),
      },);

      const allMessages = await msgStore.values();

      // Utilizando o padrão Record-Key ("auto_backups") dentro da pasta física global /backup
      const backupName = await msgStore.backupToOpfs(
        "auto_backups",
        "sw_auto_backup.json",
      );
      const opfsFiles = await listOpfsFiles();

      event.ports[0]?.postMessage({
        success: true,
        payload: {
          insertedId,
          totalMessages: allMessages.length,
          backupName,
          opfsFiles,
        },
      },);
    } catch (error) {
      event.ports[0]?.postMessage({
        success: false,
        error: (error as Error).message,
      },);
    }
  }
},);
