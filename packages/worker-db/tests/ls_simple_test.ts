import { assert, assertEquals, assertNotEquals, } from '@std/assert';
import { ls, } from '../src/fake/fake-mod.ts';

type DbItem = {
  _id: string;
  name?: string;
  type?: string;
  age?: number;
  v?: number;
};

Deno.test({
  name: "LS Simple - Gestão de _id ('auto', '0990', com prefixo)",
  fn() {
    const store = ls('LS_PRE_',);
    store.clear();

    // 1. Geração automática com _id: "auto"
    const autoKey = store.set({ _id: 'auto', name: 'Item Auto', type: 'system', },);
    assert(
      autoKey.startsWith('LS_PRE_',),
      'A chave gerada automaticamente deve conter o prefixo do banco',
    );

    // O _id retornado no objeto deve ter o prefixo removido pelo formatDbItem
    const fetchedAuto = store.get(autoKey) as DbItem;
    assert(fetchedAuto !== undefined,);
    assertNotEquals(
      fetchedAuto._id,
      'auto',
      "O _id 'auto' deve ter sido substituído por um UUID ou Hash",
    );
    assertEquals(autoKey, `LS_PRE_${fetchedAuto._id}`,);
    assertEquals(fetchedAuto.name, 'Item Auto',);

    // 2. Definindo chave customizada via parâmetro direto
    const customKey = store.set('0990', { name: 'Item Fixo', type: 'user', },);
    assertEquals(customKey, 'LS_PRE_0990',);

    // A busca aceita tanto a chave simples quanto a formatada (resolveKey cuida disso)
    const fetchedCustom = store.get('0990') as DbItem;
    assertEquals(fetchedCustom._id, '0990',);
    assertEquals(fetchedCustom.name, 'Item Fixo',);

    // 3. Salvando passando um objeto que já possui o prefixo no _id
    const keyPref = store.set({ _id: 'LS_PRE_0991', name: 'Item Fixo 2', type: 'user', },);
    assertEquals(keyPref, 'LS_PRE_0991',);
    const fetchedPref = store.get('0991') as DbItem;
    assertEquals(fetchedPref.name, 'Item Fixo 2',);

    store.clear();
  },
},);

Deno.test({
  name: 'LS Simple - CRUD Básico, Patch e Iteradores (keys, values, entries)',
  fn() {
    const store = ls('LS_CRUD_',);
    store.clear();

    // Create / Read
    store.set('user1', { name: 'Carlos', age: 30, },);
    let user = store.get('user1') as DbItem;
    assertEquals(user.name, 'Carlos',);

    // Update Parcial (Patch)
    const patchedUser = store.patch('user1', { age: 31, },);
    assertEquals(patchedUser.age, 31,);

    user = store.get('user1') as DbItem;
    assertEquals(user.age, 31,);

    // Operações em Lote (setMany, getMany)
    store.setMany([
      ['user2', { name: 'Ana', },],
      ['user3', { name: 'Beatriz', },],
    ],);

    const users = store.getMany(['user1', 'user2', 'user3',]) as DbItem[];
    assertEquals(users.length, 3,);
    assertEquals(users[1]?.name, 'Ana',);

    // Testando Iteradores (keys, values, entries)
    const allKeys = store.keys();
    assertEquals(allKeys.length, 3,);
    assert(allKeys.includes('LS_CRUD_user1',),);

    const allValues = store.values() as DbItem[];
    assertEquals(allValues.length, 3,);
    assert(allValues.some((v) => v._id === 'user2' && v.name === 'Ana'),); // Valida se formatDbItem agiu nos values

    const allEntries = store.entries() as [string, DbItem][];
    assertEquals(allEntries.length, 3,);
    const firstEntry = allEntries.find(([k,]) => k === 'LS_CRUD_user3');
    assert(firstEntry !== undefined,);
    assertEquals(firstEntry[1].name, 'Beatriz',);

    // Delete
    store.delete('user1',);
    assertEquals(store.get('user1',), undefined,);
    assertEquals(store.keys().length, 2,);

    store.deleteMany(['user2', 'user3',],);
    assertEquals(store.keys().length, 0,);

    store.clear();
  },
},);

Deno.test({
  name: 'LS Simple - Import e Export com Respeito ao Escopo/Prefixo',
  fn() {
    const store = ls('LS_EXP_',);
    store.clear();

    const mockData = {
      LS_EXP_k1: { v: 1, label: 'A', },
      LS_EXP_k2: { v: 2, label: 'B', },
    };

    store.importLS(mockData, true,);

    const exported = store.exportLS();
    assertEquals(exported, mockData,);

    const values = store.values() as DbItem[];
    assertEquals(values.length, 2,);
    assertEquals(values.find((i) => i._id === 'k1')?.v, 1,);

    store.clear();
  },
},);
