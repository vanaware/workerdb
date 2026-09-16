import { assert, assertEquals, assertNotEquals, assertThrows, } from '@std/assert';
import { ls, } from '../src/fake/fake-mod.ts';
import { type WithId, } from '../src/utils/id.ts';

Deno.test({
  name: 'LS Advanced - Execução de Métodos Modernos de Array JS (query, getSome)',
  fn() {
    const store = ls('LS_FINANCAS_',);
    store.clear();

    store.importLS({
      LS_FINANCAS_f1: { tag: 'work', amount: 150, status: 'paid', code: 'x', },
      LS_FINANCAS_f2: { tag: 'personal', amount: 300, status: 'pending', code: 'y', },
      LS_FINANCAS_f3: { tag: 'work', amount: 500, status: 'paid', code: 'z', },
      LS_FINANCAS_f4: { tag: 'home', amount: 80, status: 'pending', code: 'w', },
      LS_FINANCAS_f5: { tag: 'work', amount: 200, status: 'paid', code: 'k', },
    },);

    // Valida execução de funções avançadas síncronas de Array
    const result = store.query((items) => {
      const data = items as Record<string, unknown>[];
      return {
        count: data.length, // length
        total: data.reduce((acc, i) => acc + (i.amount as number), 0,), // reduce
        firstWork: data.find((i) => i.tag === 'work'), // find
        lastWork: data.findLast((i) => i.tag === 'work'), // findLast
        lastItem: data.at(-1,), // at
        hasPending: data.some((i) => i.status === 'pending'), // some
        allPositive: data.every((i) => (i.amount as number) > 0), // every
        tagsHaveHome: data.map((i) => i.tag as string).includes('home',), // map e includes
        idxPersonal: data.findIndex((i) => i.tag === 'personal'), // findIndex
        lastIdxWork: data.findLastIndex((i) => i.tag === 'work'), // findLastIndex
        indexOfZ: data.map((i) => i.code as string).indexOf('z',), // indexOf
        paidItems: data.filter((i) => i.status === 'paid'), // filter
        sliced: data.slice(1, 4,), // slice
        sortedByAmount: data.toSorted((a, b) => (a.amount as number) - (b.amount as number)), // toSorted
        reversed: data.toReversed(), // toReversed
        spliced: data.toSpliced(0, 2,), // toSpliced
      };
    },);

    assertEquals(result.count, 5,);
    assertEquals(result.total, 1230,);
    assertEquals((result.firstWork as Record<string, unknown>).amount, 150,);
    assertEquals((result.lastWork as Record<string, unknown>).amount, 200,);
    assertEquals((result.lastItem as Record<string, unknown>).code, 'k',);
    assert(result.hasPending,);
    assert(result.allPositive,);
    assert(result.tagsHaveHome,);
    assertEquals(result.idxPersonal, 1,);
    assertEquals(result.lastIdxWork, 4,);
    assertEquals(result.indexOfZ, 2,);
    assertEquals(result.paidItems.length, 3,);
    assertEquals(result.sliced.length, 3,);
    assertEquals((result.sortedByAmount[0] as Record<string, unknown>).amount, 80,);
    assertEquals((result.reversed[0] as Record<string, unknown>).code, 'k',);
    assertEquals(result.spliced.length, 3,);

    store.clear();
  },
},);

Deno.test({
  name: 'LS Advanced - Erros de Tipagem Síncronos (Retornos Inválidos)',
  fn() {
    const store = ls('LS_ERROS_',);
    store.clear();
    store.set('1', { valid: true, },);

    // AssertThrows captura as exceções síncronas disparadas pelo wrapper ls()
    assertThrows(
      () => store.getSome(() => ({ obj: 'invalid', } as unknown as WithId<unknown>[])),
      Error,
      'A função em getSome deve retornar um Array.',
    );

    assertThrows(
      () => store.delSome(() => false as unknown as WithId<unknown>[]),
      Error,
      'A função em delSome deve retornar um Array.',
    );

    assertThrows(
      () => store.setSome(() => 'string' as unknown as WithId<unknown>[], (i: unknown,) => i as unknown as WithId<unknown>),
      Error,
      'A função de seleção em setSome deve retornar um Array.',
    );

    store.clear();
  },
},);

Deno.test({
  name: 'LS Advanced - Transformações de Tipo, Mutação em Massa e Exclusão Segura',
  fn() {
    const store = ls('LS_EMPRESA_',);
    store.clear();

    store.importLS({
      LS_EMPRESA_e10: { name: 'joão silva', department: 'tecnologia', level: 2, active: true, },
      LS_EMPRESA_e20: { name: 'maria souza', department: 'rh', level: 3, active: true, },
      LS_EMPRESA_e30: { name: 'pedro alves', department: 'vendas', level: 1, active: false, },
    },);

    // Atualiza nome para UPPERCASE e converte 'level' (number) para string
    store.setSome(
      (items) => {
        const data = items as Record<string, unknown>[];
        return data.filter((item) => (item.active as boolean) === true) as WithId<Record<string, unknown>>[];
      },
      (item) => {
        const data = item as Record<string, unknown>;
        return {
          ...data,
          name: (data.name as string).toUpperCase(),
          department: (data.department as string).toUpperCase(),
          level: String(data.level as number), // Mutação de tipo explícita!
          _id: data._id as string,
        };
      },
    );

    const e10 = store.get<Record<string, unknown>>('e10',);
    assertEquals(e10?.name, 'JOÃO SILVA',);
    assertEquals(e10?.department, 'TECNOLOGIA',);
    assertEquals(typeof e10?.level, 'string',);
    assertEquals(e10?.level, '2',);

    const e30 = store.get<Record<string, unknown>>('e30',);
    assertEquals(e30?.department, 'vendas',); // Permanece em lowercase pois active=false
    assertEquals(typeof e30?.level, 'number',); // Permanece tipo número

    // Exclui funcionários inativos via delSome
    store.delSome((items) => {
      const data = items as Record<string, unknown>[];
      return data.filter((i) => (i.active as boolean) === false) as WithId<Record<string, unknown>>[];
    });

    // Checa deleção correta
    assertEquals(store.get('e30',), undefined,);
    const remainingKeys = store.keys();
    assertEquals(remainingKeys.length, 2,);

    // Assegura integridade dos que ficaram
    const remaining = store.values<Record<string, unknown>>();
    assertNotEquals(remaining[0]?.name as string, 'pedro alves',);

    store.clear();
  },
},);