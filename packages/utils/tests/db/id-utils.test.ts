/// <reference lib="deno.ns" />
import 'fake-indexeddb/auto';
import { assert, assertEquals, assertNotEquals, } from '@std/assert';
import { gerarId, gerarIdFallback, validarId, } from '../../src/db/mod.ts';

Deno.test('gerarId - Deve gerar um ID no formato string e com tamanho adequado', () => {
  const id = gerarId();
  assert(typeof id === 'string', 'O ID gerado deve ser uma string',);
  assert(id.length > 0 && id.length <= 24, 'O tamanho do ID deve estar entre 1 e 24 caracteres',);
});

Deno.test('gerarId - Não deve gerar IDs duplicados em chamadas sequenciais', () => {
  const id1 = gerarId();
  const id2 = gerarId();
  assertNotEquals(id1, id2, 'IDs gerados sequencialmente não podem ser idênticos',);
});

Deno.test('gerarIdFallback - Deve funcionar como alternativa segura', () => {
  const idFallback = gerarIdFallback();
  assert(typeof idFallback === 'string', 'O ID de fallback deve ser uma string',);
  assert(idFallback.length > 0, 'O ID de fallback não pode ser vazio',);
});

Deno.test('validarId - Deve validar corretamente limites de tamanho', () => {
  const idValido = gerarId();
  const idInvalidoLongo = 'a'.repeat(25,);
  const idInvalidoVazio = '';
  assertEquals(validarId(idValido,), true, 'Deve aceitar um ID gerado pela própria função',);
  assertEquals(
    validarId(idInvalidoLongo,),
    false,
    'Não deve aceitar IDs maiores que 24 caracteres',
  );
  assertEquals(validarId(idInvalidoVazio,), false, 'Não deve aceitar IDs vazios',);
});
