const esbuild = require('esbuild');
const fs = require('fs');
const { join } = require('path');

async function buildCLI() {
  try {
    await esbuild.build({
      entryPoints: [join(__dirname, '../src/cli/index.ts')],
      bundle: true,
      platform: 'node',
      target: 'node16',
      outdir: join(__dirname, '../dist/cli'),
      format: 'esm',
      external: ['node:*', 'commander', 'chalk', '@agentskillmania/settings-yaml', 'adm-zip'],
      logLevel: 'info',
    });
    console.log('✓ CLI built successfully');

    // Copy the runtime installer into dist/scripts so the "bundled" candidate
    // in src/lib/runtime.ts (dist/cli -> ../scripts) resolves to a real file
    // in the published package.
    fs.mkdirSync(join(__dirname, '../dist/scripts'), { recursive: true });
    fs.copyFileSync(
      join(__dirname, 'install-runtime.cjs'),
      join(__dirname, '../dist/scripts/install-runtime.cjs')
    );
    console.log('✓ install-runtime.cjs copied to dist/scripts');
  } catch (error) {
    console.error('✗ CLI build failed:', error);
    process.exit(1);
  }
}

buildCLI();
