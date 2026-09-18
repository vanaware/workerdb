import { db, ls, } from "../src/fake/fake-mod.ts";

interface WorkerDBMessage {
  _id?: string;
  senderId: string;
  recipientId: string;
  content: string;
  status: "pending" | "sent" | "delivered";
  timestamp: number;
}

interface UserPreferences {
  _id?: string; // Corrigindo a tipagem aqui também
  theme: "dark" | "light";
  notificationsEnabled: boolean;
  activeChatId: string | null;
}

async function runWorkerDBDbDemo() {
  console.log("🚀 [WorkerDB PWA] Iniciando demonstração do WORKER-DB...\n",);
  ls().clear();

  console.log("📦 1. LocalStorage - Criando itens com _id 'auto'...",);
  const prefStore = ls("WORKERDB_PREF_",);

  const autoKey1 = prefStore.set<UserPreferences>({
    _id: "auto",
    theme: "dark",
    notificationsEnabled: true,
    activeChatId: "chat_1",
  },);
  const autoKey2 = prefStore.set<UserPreferences>({
    _id: "auto",
    theme: "light",
    notificationsEnabled: false,
    activeChatId: null,
  },);

  console.log(`   --> Item 1 gerado: Chave = ${autoKey1}`,);
  console.log(
    `   --> Recuperando Item 1 (notem que '_id' volta limpo):`,
    prefStore.get(autoKey1,),
  );
  console.log(`   --> Recuperando Item 2:`, prefStore.get(autoKey2,),);

  console.log("\n🔒 2. LocalStorage - Testando Isolamento de Prefixos...",);
  const authStore = ls("WORKERDB_AUTH_",);
  authStore.set("session_token", { token: "abc-123", active: true, },);
  console.log(
    `   --> Total de itens em WORKERDB_PREF_ (Preferências): ${prefStore.keys().length}`,
  );
  console.log(
    `   --> Total de itens em WORKERDB_AUTH_ (Autenticação): ${authStore.keys().length}`,
  );

  console.log("\n🌍 3. LocalStorage - Visão Global (Sem prefixo)...",);
  const globalStore = ls();
  const allKeys = globalStore.keys();
  console.log(
    `   --> Total de itens armazenados em TODA a aplicação: ${allKeys.length}`,
  );
  console.log(
    `   --> Realizando leitura global do token:`,
    globalStore.get("WORKERDB_AUTH_session_token",),
  );

  console.log("\n💬 4. IndexedDB Worker - Enfileirando Mensagens Offline...",);
  const msgStore = db("WORKERDB_DATA", "messages", "MSG_",);
  await msgStore.clear();

  const msgId1 = await msgStore.set<WorkerDBMessage>({
    _id: "auto",
    senderId: "user_alice",
    recipientId: "user_bob",
    content: "Olá! Esta mensagem foi enfileirada offline.",
    status: "pending",
    timestamp: Date.now(),
  },);

  console.log(
    `   --> Mensagens injetadas no IndexedDB. Keys geradas: ${msgId1}`,
  );

  console.log("\n⚙️ 5. IndexedDB Worker - Mutações Assíncronas...",);
  const pendingCount = await msgStore.query<WorkerDBMessage, number>(
    (items,) => {
      return items.filter((m,) => m.status === "pending").length;
    },
  );
  console.log(
    `   --> Total pendente (calculado remotamente): ${pendingCount}`,
  );

  await msgStore.setSome<WorkerDBMessage>(
    (items,) => items.filter((m,) => m.status === "pending"),
    (item,) => ({ ...item, status: "sent", }),
  );

  const updatedMessages = await msgStore.values<WorkerDBMessage>();
  console.log(
    "   --> Estado das mensagens após envio simulado:",
    updatedMessages,
  );

  db.terminate();
  console.log("\n✅ Demonstração finalizada. Worker encerrado.",);
}

runWorkerDBDbDemo();
