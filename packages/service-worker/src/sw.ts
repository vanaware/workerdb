// packages/service-worker/src/sw.ts
/// <reference lib="webworker" />

import { db, } from "@vanaware/workerdb/sw";
import {
  createOpfsFetchHandler,
  handleOpfsRequest,
  listOpfsFiles,
} from "./explorer.ts";

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", () => {
  sw.skipWaiting();
},);

sw.addEventListener("activate", (event,) => {
  event.waitUntil(sw.clients.claim(),);
},);

// Intercept fetch requests for the OPFS Explorer route (/opfs)
sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === "/opfs" || url.pathname.startsWith("/opfs/")) {
    event.respondWith(
      (async () => {
        const opfsResult = await handleOpfsRequest(event.request, {
          routePrefix: "/opfs",
          title: "OPFS Explorer",
        });
        return opfsResult.response || new Response("Not Found", { status: 404 });
      })(),
    );
  }
});

// Demo Message IPC handler
sw.addEventListener("message", async (event,) => {
  if (event.data && event.data.type === "RUN_SW_DEMO") {
    try {
      const msgStore = db("WORKERDB_DATA", "messages", "MSG_",);

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
