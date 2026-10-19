import path from 'path';
import {bundle} from '@remotion/bundler';

async function main(): Promise<void> {
  const directory = await bundle({
    entryPoint: path.resolve(__dirname, '../remotion/index.ts'),
    publicDir: path.resolve(__dirname, '../assets'),
    outDir: path.resolve(__dirname, '../remotion-bundle'),
  });
  console.log(`Built reusable Remotion bundle: ${directory}`);
  console.log(`Bundler process peak RSS: ${(process.resourceUsage().maxRSS / 1024).toFixed(1)} MiB`);
}
main().catch(error => {console.error(error); process.exitCode = 1;});
