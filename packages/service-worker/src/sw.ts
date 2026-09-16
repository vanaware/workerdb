// ## Arquivo: monorepo/worker-db/example/sw.ts
/// <reference lib="webworker" />

import { dbsw as db, } from "@workerdb/workerdb";
import { listOpfsFiles, } from "../src/utils/opfs.ts";

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener("install", (event,) => {
  sw.skipWaiting();
},);

sw.addEventListener("activate", (event,) => {
  event.waitUntil(sw.clients.claim(),);
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
