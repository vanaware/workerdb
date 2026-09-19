// src/utils/id-utils.ts

/**
 * Type extending an object with an `_id` property.
 * @template T The base object type.
 */
export type WithId<T> = T & { _id: string };

/**
 * Generates a short, secure unique identifier.
 * Uses Web Crypto API if available, otherwise falls back to a mathematical generator.
 *
 * @returns {string} Generated 12-character ID (hexadecimal or base36).
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
 * Fallback for ID generation if crypto.getRandomValues is unavailable.
 * Combines a base36 timestamp with a random string.
 *
 * @returns {string} Temporary ID.
 */
export function gerarIdFallback(): string {
  return Date.now().toString(36) +
    Math.random().toString(36).substring(2, 8);
}

/**
 * Validates whether a string has an acceptable WorkerDB ID format.
 *
 * @param {string} id The ID to validate.
 * @returns {boolean} True if the ID is valid (non-empty string up to 24 characters).
 */
export function validarId(id: string): boolean {
  return typeof id === "string" && id.length > 0 && id.length <= 24;
}

/**
 * Generates a prefixed unique ID.
 *
 * @param {string} prefix The prefix to prepend to the ID.
 * @returns {string} The prefixed ID.
 */
export function gerarIdComPrefixo(prefix: string): string {
  return `${prefix}${gerarId()}`;
}

/**
 * Dynamically injects the `_id` field into an object when reading from storage,
 * stripping the prefix if present.
 *
 * @param {IDBValidKey} key The raw IndexedDB/LocalStorage key.
 * @param {unknown} val The raw stored value.
 * @param {string} [prefix=""] The prefix to remove from the key.
 * @returns {unknown} The object with the injected `_id` field.
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
 * Prepares a record for storage, generating automatic keys and stripping the internal `_id`.
 *
 * @param {string | undefined | null} key Suggested key or "auto".
 * @param {unknown} val Object to be saved.
 * @param {string} [prefix=""] Prefix to apply to the final key.
 * @returns {{ key: string; cleanVal: unknown }} Object containing the final key and sanitized value.
 * @throws {Error} If no key can be determined.
 * @internal
 */
export function prepareForSave(
  key: string | undefined | null,
  val: unknown,
  prefix = "",
): { key: string; cleanVal: unknown } {
  let rawId = val && typeof val === "object" && !Array.isArray(val)
    ? (val as Record<string, unknown>)._id as string | undefined
    : undefined;

  if (rawId === "auto") {
    rawId = gerarId();
  }

  // Intercept key provided as "auto" via direct parameter or setMany tuple
  const processKey = key === "auto" ? gerarId() : key;

  let finalKey = processKey || "";

  if (rawId) {
    if (prefix && rawId.startsWith(prefix)) {
      finalKey = rawId;
    } else {
      finalKey = prefix ? `${prefix}${rawId}` : rawId;
    }
  } else if (processKey) {
    if (prefix && processKey.startsWith(prefix)) {
      finalKey = processKey;
    } else {
      finalKey = prefix ? `${prefix}${processKey}` : processKey;
    }
  }

  if (!finalKey) {
    throw new Error(
      "A key or an '_id' attribute on the object must be provided.",
    );
  }

  if (
    val && typeof val === "object" && !Array.isArray(val) &&
    "_id" in (val as Record<string, unknown>)
  ) {
    const { _id: _, ...cleanVal } = val as Record<string, unknown>;
    return { key: finalKey, cleanVal };
  }

  return { key: finalKey, cleanVal: val };
}
