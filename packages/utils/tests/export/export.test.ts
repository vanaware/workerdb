/**
 * @file export.test.ts
 * @description Testes unitários para a lógica de filtragem do script de exportação de contexto.
 * Garante que caminhos adicionais (como .github) e regras de pastaBase funcionem corretamente.
 */
import { assertEquals, } from '@std/assert';
import { deveIncluirArquivo, } from '../../src/export/mod.ts';
import { CONFIGURACOES, } from '../../../../export.ts';

Deno.test('deveIncluirArquivo: Deve BLOQUEAR qualquer arquivo dentro da pasta exports/', () => {
  const config = CONFIGURACOES.server;
  assertEquals(deveIncluirArquivo('exports/server.md', config,), false,);
  assertEquals(deveIncluirArquivo('exports/.github/workflows/test.yml', config,), false,);
});

Deno.test('deveIncluirArquivo: Deve PERMITIR caminho adicional (.github/workflows) com extensão válida', () => {
  const config = CONFIGURACOES.server;
  assertEquals(deveIncluirArquivo('.github/workflows/deploy.yml', config,), true,);
  assertEquals(deveIncluirArquivo('.github/workflows/ci.yaml', config,), true,);
});

Deno.test('deveIncluirArquivo: Deve BLOQUEAR caminho adicional com extensão INVÁLIDA', () => {
  const config = CONFIGURACOES.server;
  assertEquals(deveIncluirArquivo('.github/workflows/segredo.png', config,), false,);
  assertEquals(deveIncluirArquivo('.github/workflows/config.secret', config,), false,);
});

Deno.test('deveIncluirArquivo: Deve PERMITIR arquivo dentro da pastaBase e subpasta permitida', () => {
  const config = CONFIGURACOES.server;
  // 🔥 CORREÇÃO: 'monorepo' alterado para 'packages' para bater com pastaBase: "packages/server"
  assertEquals(deveIncluirArquivo('packages/server/src/main.ts', config,), true,);
  assertEquals(deveIncluirArquivo('packages/server/docs/arquitetura.md', config,), true,);
});

Deno.test('deveIncluirArquivo: Deve BLOQUEAR arquivo fora da pastaBase (que não seja caminho adicional)', () => {
  const config = CONFIGURACOES.server;
  assertEquals(deveIncluirArquivo('packages/ui/src/app.tsx', config,), false,);
  assertEquals(deveIncluirArquivo('packages/utils/src/helper.ts', config,), false,);
});

Deno.test('deveIncluirArquivo: Deve PERMITIR arquivos raiz explicitamente configurados', () => {
  const config = CONFIGURACOES.server;
  // 🔥 CORREÇÃO: 'monorepo' alterado para 'packages'
  assertEquals(deveIncluirArquivo('packages/server/deno.json', config,), true,);
  assertEquals(deveIncluirArquivo('packages/server/deploy.sh', config,), true,);
});

Deno.test('deveIncluirArquivo: Deve BLOQUEAR arquivos raiz NÃO configurados', () => {
  const config = CONFIGURACOES.server;
  assertEquals(deveIncluirArquivo('packages/server/package.json', config,), false,);
});

Deno.test("deveIncluirArquivo: Configuração 'docs' deve capturar raiz e subpasta docs", () => {
  const config = CONFIGURACOES.docs;
  assertEquals(deveIncluirArquivo('readme.md', config,), true,);
  assertEquals(deveIncluirArquivo('docs/arquitetura.md', config,), true,);
  assertEquals(deveIncluirArquivo('src/main.ts', config,), false,);
});
