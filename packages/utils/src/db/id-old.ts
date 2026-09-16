// src/utils/id-utils.ts

/**
 * Gera um identificador único curto seguro.
 * Utiliza Web Crypto API se disponível, senão cai no fallback matemático.
 * @returns {string} ID gerado
 */
export function gerarId(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(12,);
    crypto.getRandomValues(array,);
    return Array.from(array, (byte,) => byte.toString(16,).padStart(2, '0',),).join('',).substring(
      0,
      12,
    );
  }
  return gerarIdFallback();
}

/**
 * Fallback para geração de ID caso crypto.getRandomValues não esteja disponível.
 * Combina o timestamp em base36 com um random.
 * @returns {string} ID temporário
 */
export function gerarIdFallback(): string {
  return Date.now().toString(36,) + Math.random().toString(36,).substring(2, 8,);
}

/**
 * Valida se a string tem formato aceitável de ID.
 * @param {string} id
 * @returns {boolean}
 */
export function validarId(id: string,): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 24;
}
