const esbuild = require('esbuild');
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
  } catch (error) {
    console.error('✗ CLI build failed:', error);
    process.exit(1);
  }
}

buildCLI();
