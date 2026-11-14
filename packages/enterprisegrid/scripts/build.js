import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const entryPoint = path.resolve(PACKAGE_ROOT, 'src/index.ts');
const outDir = path.resolve(PACKAGE_ROOT, 'dist');

const shared = {
  entryPoints: [entryPoint],
  bundle: true,
  minify: false,
  sourcemap: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime'
  ],
  loader: {
    '.css': 'css',
  },
};

async function main() {
  console.log('=== EnterpriseGrid esbuild Compiler ===');
  
  fs.mkdirSync(outDir, { recursive: true });

  try {
    // 1. Build ESM (.mjs)
    console.log('Compiling ESM format (dist/enterprisegrid.mjs)...');
    await esbuild.build({
      ...shared,
      format: 'esm',
      outfile: path.join(outDir, 'enterprisegrid.mjs'),
    });

    // 2. Build CJS (.cjs)
    console.log('Compiling CommonJS format (dist/enterprisegrid.cjs)...');
    await esbuild.build({
      ...shared,
      format: 'cjs',
      platform: 'node',
      outfile: path.join(outDir, 'enterprisegrid.cjs'),
    });

    // 3. Build CSS (dist/enterprisegrid.css)
    console.log('Compiling CSS styles (dist/enterprisegrid.css)...');
    await esbuild.build({
      entryPoints: [path.resolve(PACKAGE_ROOT, 'src/style.css')],
      bundle: true,
      outfile: path.join(outDir, 'enterprisegrid.css'),
      loader: {
        '.png': 'dataurl',
        '.gif': 'dataurl',
        '.svg': 'dataurl',
        '.css': 'css',
      },
    });

    // 4. Generate TypeScript typings
    console.log('Generating declaration files (dist/**/*.d.ts)...');
    execSync('npx tsc --emitDeclarationOnly', { cwd: PACKAGE_ROOT, stdio: 'inherit' });

    // 5. Mirror dist and package.json into root node_modules/@enterprisegrid/grid if present
    // (Prevents stale/missing dist when package managers copy/hardlink file: dependencies instead of symlinking)
    const nodeModulesPkgDir = path.resolve(PACKAGE_ROOT, '../../node_modules/@enterprisegrid/grid');
    if (fs.existsSync(nodeModulesPkgDir)) {
      const nodeModulesDistDir = path.join(nodeModulesPkgDir, 'dist');
      fs.mkdirSync(nodeModulesDistDir, { recursive: true });
      for (const entry of fs.readdirSync(outDir)) {
        const srcFile = path.join(outDir, entry);
        const destFile = path.join(nodeModulesDistDir, entry);
        if (fs.statSync(srcFile).isFile()) {
          const srcStat = fs.statSync(srcFile);
          const destExists = fs.existsSync(destFile);
          if (!destExists || fs.statSync(destFile).ino !== srcStat.ino) {
            if (destExists) fs.rmSync(destFile, { force: true });
            fs.copyFileSync(srcFile, destFile);
          }
        }
      }
      const srcPkg = path.join(PACKAGE_ROOT, 'package.json');
      const destPkg = path.join(nodeModulesPkgDir, 'package.json');
      if (!fs.existsSync(destPkg) || fs.statSync(destPkg).ino !== fs.statSync(srcPkg).ino) {
        if (fs.existsSync(destPkg)) fs.rmSync(destPkg, { force: true });
        fs.copyFileSync(srcPkg, destPkg);
      }
      console.log('Synced dist/ and package.json to node_modules/@enterprisegrid/grid');
    }

    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

main();
