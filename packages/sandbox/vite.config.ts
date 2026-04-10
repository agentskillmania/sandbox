import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      outDir: 'dist',
      rollupTypes: true,
    }),
  ],
  appType: 'custom',
  build: {
    lib: {
      entry: './src/index.ts',
      name: '@agentskillmania/sandbox',
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'node:*',
        'fs',
        'path',
        'os',
        'child_process',
        'fs/promises',
        'commander',
        'chalk',
        '@agentskillmania/settings-yaml',
        'adm-zip',
      ],
      output: {
        globals: {},
        // Build CLI separately
        manualChunks: (id) => {
          if (id.includes('/cli/')) {
            return 'cli';
          }
        },
      },
    },
    target: 'node16',
    minify: false,
    ssr: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'node_modules/',
        'src/cli/**',
        'src/index.ts',
      ],
      lines: 90,
      functions: 90,
      branches: 90,
      statements: 90,
    },
  },
});
