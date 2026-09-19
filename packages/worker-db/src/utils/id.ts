// src/utils/id-utils.ts

/**
 * Tipo que estende um objeto com a propriedade `_id`.
 * @template T O tipo base do objeto.
 */
export type WithId<T> = T & { _id: string };

/**
 * Gera um identificador único curto seguro.
 * Utiliza Web Crypto API se disponível, senão utiliza um fallback matemático.
 *
 * @returns {string} ID gerado de 12 caracteres (hexadecimal ou base36).
 *
 * @example
 * ```ts
 * const id = gerarId();
 * console.log(id); // "a1b2c3d4e5f6"
 * ```
 */
export function gerarId(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0"))
      .join("").substring(
        0,
        12,
      );
  }
  return gerarIdFallback();
}

/**
 * Fallback para geração de ID caso crypto.getRandomValues não esteja disponível.
 * Combina o timestamp em base36 com uma string aleatória.
 *
 * @returns {string} ID temporário.
 */
export function gerarIdFallback(): string {
  return Date.now().toString(36) +
    Math.random().toString(36).substring(2, 8);
}

/**
 * Valida se uma string tem o formato aceitável de ID do WorkerDB.
 *
 * @param {string} id O ID a ser validado.
 * @returns {boolean} True se o ID for válido (string não vazia até 24 caracteres).
 */
export function validarId(id: string): boolean {
  return typeof id === "string" && id.length > 0 && id.length <= 24;
}

/**
 * Gera um ID único prefixado.
 *
 * @param {string} prefix O prefixo a ser adicionado ao ID.
 * @returns {string} O ID prefixado.
 */
export function gerarIdComPrefixo(prefix: string): string {
  return `${prefix}${gerarId()}`;
}

/**
 * Injeta dinamicamente o campo `_id` em um objeto ao ler do banco de dados,
 * removendo o prefixo se presente.
 *
 * @param {IDBValidKey} key A chave bruta do IndexedDB/LocalStorage.
 * @param {unknown} val O valor bruto armazenado.
 * @param {string} [prefix=""] O prefixo a ser removido da chave.
 * @returns {unknown} O objeto com o campo `_id` injetado.
 * @internal
 */
export function formatDbItem(
  key: IDBValidKey,
  val: unknown,
  prefix = "",
): unknown {
  if (!val || typeof val !== "object" || Array.isArray(val)) return val;
  const keyStr = String(key);
  const _id = prefix && keyStr.startsWith(prefix)
    ? keyStr.slice(prefix.length)
    : keyStr;
  return { _id, ...val };
}

/**
 * Prepara um registro para gravação, gerando chaves automáticas e removendo o `_id` interno.
 *
 * @param {string | undefined | null} key Chave sugerida ou "auto".
 * @param {unknown} val Objeto a ser salvo.
 * @param {string} [prefix=""] Prefixo a ser aplicado à chave final.
 * @returns {{ key: string; cleanVal: unknown }} Objeto contendo a chave final e o valor limpo.
 * @throws {Error} Se nenhuma chave puder ser determinada.
 * @internal
 */
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
