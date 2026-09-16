// ## Arquivo: monorepo/worker-db/example/main.ts
import { db, ls, opfs, } from "@workerdb/workerdb";

interface WorkerDBMessage {
  _id?: string;
  senderId: string;
  recipientId: string;
  content: string;
  status: "pending" | "sent" | "delivered" | "read";
  priority: number;
  timestamp: number;
}

interface UserPreferences {
  _id?: string;
  theme: "dark" | "light";
  notificationsEnabled: boolean;
  activeChatId: string | null;
}

const appElement = document.getElementById("app",);
const logElement = document.getElementById("log-output",);

function log(msg: string, data?: unknown,) {
  const dataStr = data ? `\n  ↳ ${JSON.stringify(data, null, 2,)}` : "";
  const fullText = `${msg}${dataStr}\n`;

  if (logElement) {
    if (logElement.innerText.includes("Aguardando execução",)) {
      logElement.innerText = "";
    }
    logElement.innerText += fullText;
  }
  console.log(msg, data || "",);
}

async function runRealWorldTests() {
  log(
    "🚀 INICIANDO DEMONSTRAÇÃO AVANÇADA DO SYNTAXMESH PWA (AMBIENTE REAL)\n",
  );

  ls().clear();
  db.init();

  log("📦 1. LocalStorage - Escopos e Prefixos...",);
  const prefStore = ls("SYNTAXMESH_PREF_",);
  prefStore.set<UserPreferences>({
    _id: "auto",
    theme: "dark",
    notificationsEnabled: true,
    activeChatId: "chat_1",
  },);
  log(
    `   --> Total de chaves isoladas de Preferências: ${prefStore.keys().length}`,
  );

  log("\n💬 2. IndexedDB Worker - Populando Fila de Mensagens...",);
  const msgStore = db("SYNTAXMESH_DATA", "messages", "MSG_",);
  await msgStore.clear();

  const now = Date.now();
  await msgStore.setMany([
    ["auto", {
      senderId: "alice",
      recipientId: "bob",
      content: "Oi!",
      status: "delivered",
      priority: 1,
      timestamp: now - 5000,
    },],
    ["auto", {
      senderId: "alice",
      recipientId: "bob",
      content: "Tudo bem?",
      status: "pending",
      priority: 1,
      timestamp: now - 4000,
    },],
  ],);
  log(
    `   --> Total de mensagens injetadas com UUIDs gerados com sucesso: ${
      (await msgStore.keys()).length
    }`,
  );

  log("\n📊 3. IndexedDB Worker - Análises e Agregações Remotas (query)...",);
  const stats = await msgStore.query<WorkerDBMessage, unknown>((items,) => ({
    totalPending: items.filter((i,) => i.status === "pending").length,
  }));
  log(`   --> Estatísticas processadas no Worker:`, stats,);

  log(
    "\n💾 4. Origin Private File System (OPFS) - Backup via opfs() com basePath 'backup'...",
  );

  // Instância OPFS dedicada exclusivamente a gerenciar a pasta física global '/backup'
  const backupDrive = opfs("SYNTAXMESH_DATA", "messages", "MSG_", "backup",);
  const RECORD_BACKUP_KEY = "mensagens_app";

  // Limpa arquivos antigos da record-key de backup usando a API unificada do OPFS
  const oldBackupFiles = await backupDrive.listFiles(RECORD_BACKUP_KEY,);
  for (const f of oldBackupFiles) {
    await backupDrive.delFile(RECORD_BACKUP_KEY, f.name,);
  }

  // Realiza o backup utilizando a record-key isolada
  await backupDrive.backupToOpfs(RECORD_BACKUP_KEY, "mensagens_v1.json",);
  const storedFiles = await backupDrive.listFiles(RECORD_BACKUP_KEY,);
  log(
    `   --> Backups gerados com sucesso. Arquivos na record-key '${RECORD_BACKUP_KEY}':`,
    storedFiles.map((f,) => f.name),
  );

  log("\n🤖 5. Service Worker - Interação em Background (db-sw.ts)...",);

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js", { type: "module", },);

      if (!navigator.serviceWorker.controller) {
        log(
          `   --> ⚠️ O Service Worker foi instalado. Pressione F5 (recarregar) para que ele assuma o controle da página.`,
        );
      } else {
        log(
          `   --> Service Worker ativo e controlando a página! Solicitando operação remota...`,
        );

        const runSwTask = () =>
          new Promise((resolve, reject,) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (e,) => {
              if (e.data.success) resolve(e.data.payload,);
              else reject(new Error(e.data.error,),);
            };
            navigator.serviceWorker.controller!.postMessage({
              type: "RUN_SW_DEMO",
            }, [
              channel.port2,
            ],);
          },);

        const swResult = await runSwTask();
        log(`   --> ✅ Resultado retornado pelo Service Worker:`, swResult,);
      }
    } catch (err) {
      log(`   ❌ Falha ao registrar o Service Worker:`, err,);
    }
  }

  // Renderiza a listagem de backups utilizando o opfs() em vez de funções soltas
  const finalStoredFiles = await backupDrive.listFiles(RECORD_BACKUP_KEY,);
  if (appElement && finalStoredFiles.length > 0) {
    const downloadContainer = document.createElement("div",);
    downloadContainer.style.marginTop = "24px";
    downloadContainer.style.padding = "16px";
    downloadContainer.style.backgroundColor = "var(--md-sys-color-surface)";
    downloadContainer.style.borderRadius = "12px";

    let linksHTML =
      `<h3 style="margin-top: 0; color: var(--md-sys-color-primary);">🗂️ Backups OPFS Gerados via opfs()</h3>`;
    linksHTML +=
      `<div style="display: flex; flex-direction: column; gap: 12px;">`;

    for (const f of finalStoredFiles) {
      linksHTML += `
      <div style="display: flex; justify-content: space-between; align-items: center; background: #1a1c19; padding: 12px 16px; border-radius: 8px;">
        <span>📁 ${f.name} - ${(f.size / 1024).toFixed(1,)} KB</span>
        <button id="dl_${
        f.name.replace(/\./g, "_",)
      }" style="cursor: pointer; background: var(--md-sys-color-primary); color: #1a1c19; border: none; font-weight: bold; border-radius: 4px; padding: 6px 12px;">
          Baixar Backup
        </button>
      </div>`;
    }

    downloadContainer.innerHTML = linksHTML + `</div>`;
    appElement.appendChild(downloadContainer,);

    setTimeout(() => {
      for (const f of finalStoredFiles) {
        const btn = document.getElementById(
          `dl_${f.name.replace(/\./g, "_",)}`,
        );
        if (btn) {
          btn.onclick = async () => {
            const fileBlob = await backupDrive.getFile(
              RECORD_BACKUP_KEY,
              f.name,
            );
            const objectUrl = URL.createObjectURL(fileBlob,);
            const a = document.createElement("a",);
            a.href = objectUrl;
            a.download = f.name;
            a.click();
            URL.revokeObjectURL(objectUrl,);
          };
        }
      }
    }, 100,);
  }

  db.terminate();
  log("\n✅ Demonstração Completa Finalizada!",);
}

// ==========================================
// SEÇÃO INTERATIVA: GERENCIADOR OPFS UI
// ==========================================
function setupInteractiveOpfsUI() {
  if (!appElement) return;

  const container = document.createElement("div",);
  container.style.marginTop = "32px";
  container.style.padding = "24px";
  container.style.backgroundColor = "var(--md-sys-color-surface)";
  container.style.borderRadius = "12px";
  container.style.border = "1px solid var(--md-sys-color-primary)";

  const title = document.createElement("h2",);
  title.style.color = "var(--md-sys-color-primary)";
  title.style.marginTop = "0";
  title.innerText = "📁 Gerenciador Interativo OPFS (Isolado)";

  const desc = document.createElement("p",);
  desc.innerText =
    "Envie múltiplos arquivos para a pasta 'ui_uploads' utilizando o wrapper unificado opfs().";

  const inputWrapper = document.createElement("div",);
  inputWrapper.style.marginBottom = "24px";

  const input = document.createElement("input",);
  input.type = "file";
  input.multiple = true;
  input.style.display = "block";
  input.style.padding = "8px 0";
  input.style.color = "var(--md-sys-color-on-background)";

  const fileListContainer = document.createElement("div",);
  fileListContainer.style.display = "flex";
  fileListContainer.style.flexDirection = "column";
  fileListContainer.style.gap = "8px";

  inputWrapper.appendChild(input,);
  container.appendChild(title,);
  container.appendChild(desc,);
  container.appendChild(inputWrapper,);
  container.appendChild(fileListContainer,);
  appElement.appendChild(container,);

  const userDrive = opfs("INTERACTIVE_DB", "files", "INT_", "ui_uploads",);
  const FOLDER_KEY = "pasta_do_usuario";

  userDrive.set(FOLDER_KEY, { created: Date.now(), type: "interactive_test", },)
    .catch(
      console.error,
    );

  const renderFiles = async () => {
    fileListContainer.innerHTML = "<p>Carregando arquivos...</p>";
    try {
      const files = await userDrive.listFiles(FOLDER_KEY,);
      fileListContainer.innerHTML = "";

      if (files.length === 0) {
        fileListContainer.innerHTML =
          "<p style='color: #888;'>Nenhum arquivo nesta pasta. Faça um upload acima!</p>";
        return;
      }

      for (const f of files) {
        const item = document.createElement("div",);
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.background = "#1a1c19";
        item.style.padding = "12px 16px";
        item.style.borderRadius = "8px";

        const name = document.createElement("span",);
        name.innerText = `${f.name} - ${(f.size / 1024).toFixed(1,)} KB`;

        const actions = document.createElement("div",);
        actions.style.display = "flex";
        actions.style.gap = "8px";

        const btnDownload = document.createElement("button",);
        btnDownload.innerText = "Baixar";
        btnDownload.style.cursor = "pointer";
        btnDownload.style.background = "var(--md-sys-color-primary)";
        btnDownload.style.color = "#1a1c19";
        btnDownload.style.border = "none";
        btnDownload.style.fontWeight = "bold";
        btnDownload.style.borderRadius = "4px";
        btnDownload.style.padding = "6px 12px";

        btnDownload.onclick = async () => {
          try {
            const btnOriginalText = btnDownload.innerText;
            btnDownload.innerText = "Baixando...";
            btnDownload.disabled = true;

            const fileBlob = await userDrive.getFile(FOLDER_KEY, f.name,);

            const url = URL.createObjectURL(fileBlob,);
            const a = document.createElement("a",);
            a.href = url;
            a.download = f.name;
            a.click();
            URL.revokeObjectURL(url,);

            btnDownload.innerText = btnOriginalText;
            btnDownload.disabled = false;
          } catch (err) {
            console.error("Erro no download:", err,);
            btnDownload.innerText = "Erro!";
          }
        };

        const btnDelete = document.createElement("button",);
        btnDelete.innerText = "Excluir";
        btnDelete.style.cursor = "pointer";
        btnDelete.style.background = "#ff5252";
        btnDelete.style.color = "white";
        btnDelete.style.border = "none";
        btnDelete.style.fontWeight = "bold";
        btnDelete.style.borderRadius = "4px";
        btnDelete.style.padding = "6px 12px";

        btnDelete.onclick = async () => {
          btnDelete.disabled = true;
          btnDelete.innerText = "Excluindo...";
          await userDrive.delFile(FOLDER_KEY, f.name,);
          await renderFiles();
        };

        actions.appendChild(btnDownload,);
        actions.appendChild(btnDelete,);

        item.appendChild(name,);
        item.appendChild(actions,);
        fileListContainer.appendChild(item,);
      }
    } catch (err) {
      fileListContainer.innerHTML =
        `<p style="color: #ff5252;">Erro ao listar: ${
          (err as Error).message
        }</p>`;
    }
  };

  input.onchange = async () => {
    if (!input.files || input.files.length === 0) return;

    input.disabled = true;

    try {
      for (const file of Array.from(input.files,)) {
        await userDrive.addFile(FOLDER_KEY, file, file.name,);
      }
    } catch (err) {
      console.error("Erro ao subir arquivo:", err,);
    } finally {
      input.disabled = false;
      input.value = "";
      await renderFiles();
    }
  };

  renderFiles();
}

runRealWorldTests()
  .then(() => setupInteractiveOpfsUI())
  .catch((err,) => {
    log("❌ OCORREU UM ERRO FATAL:", err.message,);
  },);
