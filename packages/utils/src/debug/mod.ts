import { DEBUG_CHANNEL_NAME, } from '../config/mod.ts';
import type { DebugLogPayload, } from '../interfaces/mod.ts';

// 🔥 Lazy initialization: só cria o channel quando for usado pela primeira vez
let debugChannel: BroadcastChannel | null = null;

function getDebugChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }

  // Inicializa apenas uma vez, sob demanda
  if (debugChannel === null) {
    try {
      debugChannel = new BroadcastChannel(DEBUG_CHANNEL_NAME,);
    } catch (err) {
      console.warn('Erro ao criar BroadcastChannel:', err,);
      return null;
    }
  }

  return debugChannel;
}

/**
 * Emite logs desacoplados via BroadcastChannel para o DebugPanel e inspeciona no console nativo.
 * Esta função suporta retrocompatibilidade, aceitando tanto 1 argumento (msg) quanto a versão rica.
 */
export function addDebugLog(
  typeOrMsg: string,
  moduleOrDetails?: unknown,
  message?: string,
  details?: unknown,
): void {
  let logType: DebugLogPayload['type'] = 'info';
  let logModule = 'SYSTEM';
  let logMessage = '';
  let logDetails: unknown = undefined;

  // Trata a sobrecarga de argumentos
  if (arguments.length === 1 || (arguments.length === 2 && typeof moduleOrDetails !== 'string')) {
    logType = 'info';
    logModule = 'APP';
    logMessage = typeOrMsg;
    logDetails = moduleOrDetails;
  } else {
    logType = (typeOrMsg as DebugLogPayload['type']) || 'info';
    logModule = moduleOrDetails as string || 'SYSTEM';
    logMessage = message || '';
    logDetails = details;
  }

  // 🔥 Cria a estrutura exata que o DebugPanel.tsx espera receber
  const entry: DebugLogPayload = {
    id: `${Date.now()}-${Math.random().toString(36,).substring(2, 7,)}`,
    timestamp: new Date().toLocaleTimeString(),
    type: logType,
    module: logModule,
    message: logMessage,
    details: logDetails,
  };

  try {
    const channel = getDebugChannel();
    if (channel) {
      channel.postMessage({
        type: 'SYNTAXMESH_DEBUG_LOG',
        entry,
      },);
    }
  } catch (err) {
    console.warn('Erro ao emitir log no BroadcastChannel:', err,);
  }

  // Espelha no console de desenvolvedor do navegador
  const consoleMsg = `[${logModule}] ${logMessage}`;
  if (logType === 'error') console.error(consoleMsg, logDetails ?? '',);
  else if (logType === 'warn') console.warn(consoleMsg, logDetails ?? '',);
  else console.log(consoleMsg, logDetails ?? '',);
}
