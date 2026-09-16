import { assert, assertEquals, } from '@std/assert';
import { gerarId, validarId, } from '../src/utils/id.ts';
import { db, ls, } from '../src/fake/fake-mod.ts';

Deno.test('MAIN - Validação de Utilitários de ID e Integração Global', () => {
  const id = gerarId();
  assert(id.length > 0,);

  const isValid = validarId(id,);
  assertEquals(isValid, true,);

  const dbInstance = db('MAIN_DB', 'main',);
  assert(dbInstance !== undefined,);

  const lsInstance = ls('MAIN_LS_',);
  assert(lsInstance !== undefined,);
});
