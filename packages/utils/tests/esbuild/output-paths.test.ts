/// <reference lib="deno.ns" />
import { describe, it, } from '@std/testing/bdd';
import { assertEquals, assertStringIncludes, assertThrows, } from '@std/assert';
import { resolveOutputPaths, validateTargetConfig, } from '../../src/esbuild/mod.ts';
import type { TargetConfig, } from '../../src/interfaces/mod.ts';

describe('validateTargetConfig', () => {
  describe('distdir obrigatório', () => {
    it('lança erro quando publicdir existe mas distdir não', () => {
      const config: TargetConfig = {
        srcdir: 'src',
        publicdir: 'public',
        entryPoints: ['app.tsx',],
      };
      assertThrows(
        () => validateTargetConfig('ui', config,),
        Error,
        "'distdir'",
      );
    });
    it('lança erro quando indexHtml é true mas distdir não', () => {
      const config: TargetConfig = {
        srcdir: 'src',
        indexHtml: true,
        entryPoints: ['app.tsx',],
      };
      assertThrows(
        () => validateTargetConfig('ui', config,),
        Error,
        "'distdir'",
      );
    });
    it('lança erro quando outfile não existe e distdir não', () => {
      const config: TargetConfig = {
        srcdir: 'src',
        entryPoints: ['app.tsx',],
      };
      assertThrows(
        () => validateTargetConfig('ui', config,),
        Error,
        "'distdir'",
      );
    });
    it('NÃO lança erro quando outfile existe mas distdir não', () => {
      const config: TargetConfig = {
        srcdir: 'src',
        outfile: '/absolute/path/app.js',
        entryPoints: ['app.tsx',],
      };
      // Não deve lançar
      validateTargetConfig('ui', config,);
    });
    it('NÃO lança erro quando distdir existe', () => {
      const config: TargetConfig = {
        srcdir: 'src',
        distdir: 'dist',
        entryPoints: ['app.tsx',],
      };
      validateTargetConfig('ui', config,);
    });
  });

  describe('mensagens de erro didáticas', () => {
    it('lista todos os motivos quando múltiplas condições falham', () => {
      const config: TargetConfig = {
        srcdir: 'src',
        publicdir: 'public',
        indexHtml: true,
        entryPoints: ['app.tsx',],
      };
      try {
        validateTargetConfig('ui', config,);
      } catch (e) {
        const msg = (e as Error).message;
        assertStringIncludes(msg, "'publicdir' está configurado",);
        assertStringIncludes(msg, "'indexHtml' é true",);
        assertStringIncludes(msg, "'outfile' não está configurado",);
      }
    });
  });
});

describe('resolveOutputPaths', () => {
  describe('outfile relativo ao distdir', () => {
    it('faz join quando ambos existem', () => {
      const config: TargetConfig = {
        srcdir: 'src',
        distdir: 'monorepo/server/build/dist',
        outfile: 'app.js',
        entryPoints: ['app.tsx',],
      };
      const result = resolveOutputPaths(config,);
      assertEquals(result.outfile, 'monorepo/server/build/dist/app.js',);
      assertEquals(result.outdir, undefined,);
    });
    it('faz join com subdiretórios', () => {
      const config: TargetConfig = {
        srcdir: 'src',
        distdir: 'dist',
        outfile: 'js/app.js',
        entryPoints: ['app.tsx',],
      };
      const result = resolveOutputPaths(config,);
      assertEquals(result.outfile, 'dist/js/app.js',);
    });
  });

  describe('outfile absoluto (sem distdir)', () => {
    it('mantém outfile como está quando distdir não existe', () => {
      const config: TargetConfig = {
        srcdir: 'src',
        outfile: '/absolute/path/app.js',
        entryPoints: ['app.tsx',],
      };
      const result = resolveOutputPaths(config,);
      assertEquals(result.outfile, '/absolute/path/app.js',);
      assertEquals(result.outdir, undefined,);
    });
  });

  describe('distdir como outdir (sem outfile)', () => {
    it('usa distdir como outdir quando outfile não existe', () => {
      const config: TargetConfig = {
        srcdir: 'src',
        distdir: 'dist',
        entryPoints: ['app.tsx',],
      };
      const result = resolveOutputPaths(config,);
      assertEquals(result.outdir, 'dist',);
      assertEquals(result.outfile, undefined,);
    });
  });

  describe('nenhum configurado', () => {
    it('retorna objeto vazio', () => {
      const config: TargetConfig = {
        srcdir: 'src',
        entryPoints: ['app.tsx',],
      };
      const result = resolveOutputPaths(config,);
      assertEquals(result.outfile, undefined,);
      assertEquals(result.outdir, undefined,);
    });
  });
});
