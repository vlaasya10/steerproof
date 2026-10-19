import fs from 'fs';
import path from 'path';

let bundlePromise: Promise<string> | null = null;

/** Docker supplies a build artifact. Local development may bundle on first render. */
export async function getBundleLocation(): Promise<string> {
  const prebuilt = process.env.REMOTION_BUNDLE_DIR;
  if (prebuilt) {
    const directory = path.resolve(prebuilt);
    if (!fs.existsSync(path.join(directory, 'index.html'))) {
      throw new Error(`Prebuilt Remotion bundle missing at ${directory}; rebuild the image`);
    }
    return directory;
  }
  if (process.env.REMOTION_ALLOW_RUNTIME_BUNDLE === 'false') {
    throw new Error('Runtime Remotion bundling is disabled; configure REMOTION_BUNDLE_DIR');
  }
  if (!bundlePromise) {
    bundlePromise = import('@remotion/bundler').then(({bundle}) => bundle({
      entryPoint: path.resolve(__dirname, '../remotion/index.ts'),
      publicDir: path.resolve(__dirname, '../assets'),
    })).catch(error => {
      bundlePromise = null;
      throw error;
    });
  }
  return bundlePromise;
}
