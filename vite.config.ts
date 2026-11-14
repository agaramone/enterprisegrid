import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'disable-vite-client-ws',
        transform(code, id) {
          if (id.includes('vite/dist/client/client.mjs')) {
            return code.replace(
              'transport.connect(createHMRHandler(handleMessage));',
              '// HMR WebSocket transport disabled'
            );
          }
        },
      },
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: [
        {
          find: /^@enterprisegrid\/grid$/,
          replacement: path.resolve(__dirname, 'packages/enterprisegrid/src/index.ts'),
        },
        {
          find: /^@enterprisegrid\/grid\/(dist\/enterprisegrid\.css|style\.css)$/,
          replacement: path.resolve(__dirname, 'packages/enterprisegrid/src/style.css'),
        },
        {
          find: '@',
          replacement: path.resolve(__dirname, '.'),
        },
      ],
    },
    optimizeDeps: {
      exclude: ['@enterprisegrid/grid'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: null,
    },
  };
});
