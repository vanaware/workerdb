// build.ts
import { ensureDir, } from '@std/fs';

const clean = async () => {
  try {
    await Promise.all([
      Deno.remove('../server/build/dist/worker-db.js',),
      Deno.remove('../server/build/dist/worker-db.js.map',),
    ],);
    console.log('📁 Arquivo anterior excluído',);
  } catch {
    // diretório não existe, ok
  }
  await ensureDir('../server/build/dist',);
};

const build = async () => {
  console.log('🚀 Iniciando build do Worker DB ...',);
  const startTime = performance.now();

  try {
    await clean();

    console.log('⚙️ Gerando bundle do Worker...',);
    // @ts-ignore: Deno.bundle API interna operacional no runtime
    const result = await Deno.bundle({
      entrypoints: ['./src/worker.ts',],
      outputPath: '../server/build/dist/worker-db.js',
      platform: 'browser',
      format: 'esm',
      packages: 'bundle',
      keepnames: true,
      inlineImports: true,
      codeSplitting: false,
      minify: false,
      sourcemap: 'linked',
      write: true,
    },);

    if (!result.success) {
      console.error(result.errors,);
      throw new Error('Falha ao gerar bundle pelo compilador interno.',);
    }

    for (const warning of result.warnings || []) {
      console.warn(warning,);
    }

    const endTime = performance.now();
    console.log(`✅ Build concluído com sucesso em ${(endTime - startTime).toFixed(2,)}ms!`,);
    console.log('📁 Saída gerada no diretório: ../server/build/dist/',);
  } catch (error) {
    console.error('❌ Erro fatal durante o processo de build:',);
    console.error(error,);
    Deno.exit(1,);
  }
};

await build();
