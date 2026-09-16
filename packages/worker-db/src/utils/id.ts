// src/utils/id-utils.ts

export type WithId<T,> = T & { _id: string };

/**
 * Gera um identificador único curto seguro.
 * Utiliza Web Crypto API se disponível, senão cai no fallback matemático.
 * @returns {string} ID gerado
 */
export function gerarId(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(12,);
    crypto.getRandomValues(array,);
    return Array.from(array, (byte,) => byte.toString(16,).padStart(2, "0",),)
      .join("",).substring(
        0,
        12,
      );
  }
  return Date.now().toString(36,) +
    Math.random().toString(36,).substring(2, 8,);
}

/**
 * Valida se a string tem formato aceitável de ID.
 * @param {string} id
 * @returns {boolean}
 */
export function validarId(id: string,): boolean {
  return typeof id === "string" && id.length > 0 && id.length <= 24;
}

export function gerarIdComPrefixo(prefix: string,): string {
  return `${prefix}${gerarId()}`;
}

// Injeta dinamicamente o '_id' sem o prefixo ao LER do banco/localStorage
export function formatDbItem(
  key: IDBValidKey,
  val: unknown,
  prefix = "",
): unknown {
  if (!val || typeof val !== "object" || Array.isArray(val,)) return val;
  const keyStr = String(key,);
  const _id = prefix && keyStr.startsWith(prefix,)
    ? keyStr.slice(prefix.length,)
    : keyStr;
  return { _id, ...val, };
}

// Prepara a chave final e limpa o '_id' do objeto gravado
export function prepareForSave(
  key: string | undefined | null,
  val: unknown,
  prefix = "",
): { key: string; cleanVal: unknown } {
  let rawId = val && typeof val === "object" && !Array.isArray(val,)
    ? (val as Record<string, unknown>)._id as string | undefined
    : undefined;

  if (rawId === "auto") {
    rawId = gerarId();
  }

  // Intercepta a chave informada como "auto" via parâmetro direto ou tupla do setMany
  const processKey = key === "auto" ? gerarId() : key;

  let finalKey = processKey || "";

  if (rawId) {
    if (prefix && rawId.startsWith(prefix,)) {
      finalKey = rawId;
    } else {
      finalKey = prefix ? `${prefix}${rawId}` : rawId;
    }
  } else if (processKey) {
    if (prefix && processKey.startsWith(prefix,)) {
      finalKey = processKey;
    } else {
      finalKey = prefix ? `${prefix}${processKey}` : processKey;
    }
  }

  if (!finalKey) {
    throw new Error(
      "Uma chave (key) ou um atributo '_id' no objeto deve ser fornecido.",
    );
  }

  if (
    val && typeof val === "object" && !Array.isArray(val,) &&
    "_id" in (val as Record<string, unknown>)
  ) {
    const { _id: _, ...cleanVal } = val as Record<string, unknown>;
    return { key: finalKey, cleanVal, };
  }

  return { key: finalKey, cleanVal: val, };
}
