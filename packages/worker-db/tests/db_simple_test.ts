import { assert, assertEquals, assertNotEquals, } from '@std/assert';

import { db, } from '../src/fake/fake-mod.ts';

Deno.test({
  name: "DB Simple - Tratamento de _id ('auto', '0990', com prefixo)",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // CORREÇÃO: Utilizando um nome de banco isolado para o teste para evitar choque de instâncias no IndexedDB fake
    const store = db('LOJA_TEST_1', 'clientes', 'CLI_',);
    await store.clear();

    // 1. _id: "auto"
    const keyAuto = await store.set({ _id: 'auto', name: 'Alice', level: 1, },);
    assert(keyAuto.startsWith('CLI_',),);
    const itemAuto = await store.get<unknown>(keyAuto,) as Record<string, unknown>;
    assert(itemAuto !== undefined,);
    assertNotEquals(itemAuto?._id, 'auto',);
    assertEquals(itemAuto?.name, 'Alice',);

    // 2. _id: "0990"
    const key0990 = await store.set({ _id: '0990', name: 'Bob', level: 2, },);
    assertEquals(key0990, 'CLI_0990',);
    const item0990 = await store.get<unknown>('0990',) as Record<string, unknown>;
    assertEquals(item0990?._id, '0990',);
    assertEquals(item0990?.name, 'Bob',);

    // 3. _id: "CLI_0990" (com prefixo pré-existente)
    const keyPref = await store.set({ _id: 'CLI_0990', name: 'Bob Atualizado', level: 3, },);
    assertEquals(keyPref, 'CLI_0990',);
    const itemPref = await store.get<unknown>('0990',) as Record<string, unknown>;
    assertEquals(itemPref?.name, 'Bob Atualizado',);
  },
},);

Deno.test({
  name: 'DB Simple - CRUD, Patch e Métodos de Coleção',
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // CORREÇÃO: Isolando o banco para não colidir com o teste anterior
    const store = db('LOJA_TEST_2', 'produtos', 'PROD_',);
    await store.clear();

    await store.set('p1', { name: 'Notebook', price: 3000, },);
    const p1 = await store.get<unknown>('p1',) as Record<string, unknown>;
    assertEquals(p1?.name, 'Notebook',);

    const patched = await store.patch<Record<string, unknown>>('p1', { price: 3200, },);
    assertEquals((patched as Record<string, unknown>).price, 3200,);

    await store.setMany([
      ['p2', { name: 'Mouse', price: 80, },],
      ['p3', { name: 'Teclado', price: 200, },],
    ],);

    const items = await store.getMany<unknown>(['p1', 'p2', 'p3',],);
    assertEquals(items.length, 3,);

    const keys = await store.keys();
    assert(keys.includes('PROD_p1',),);

    await store.delete('p1',);
    assertEquals(await store.get('p1',), undefined,);

    await store.deleteMany(['p2', 'p3',],);
    assertEquals((await store.keys()).length, 0,);
  },
},);

Deno.test({
  name: 'DB Simple - ImportDB e ExportDB com Respeito ao Escopo/Prefixo',
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    // CORREÇÃO: Isolando o banco de dados
    const store = db('LOJA_TEST_3', 'estoque', 'EST_',);
    await store.clear();

    const mockData = {
      EST_e1: { item: 'Parafuso', qty: 100, },
      EST_e2: { item: 'Porca', qty: 200, },
    };

    await store.importDB(mockData, true,);

    const exported = await store.exportDB();
    assertEquals(exported, mockData,);

    const values = await store.values<unknown>();
    assertEquals(values.length, 2,);
  },
},);
