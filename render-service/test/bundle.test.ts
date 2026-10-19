import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {getBundleLocation} from '../src/bundle';

test('prebuilt artifact is reused, and missing artifacts never trigger a runtime build', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'steer-bundle-'));
  const original = {...process.env};
  try {
    process.env.REMOTION_ALLOW_RUNTIME_BUNDLE = 'false';
    process.env.REMOTION_BUNDLE_DIR = directory;
    await assert.rejects(getBundleLocation(), /Prebuilt Remotion bundle missing/);
    fs.writeFileSync(path.join(directory, 'index.html'), '<html></html>');
    assert.equal(await getBundleLocation(), directory);
    delete process.env.REMOTION_BUNDLE_DIR;
    await assert.rejects(getBundleLocation(), /Runtime Remotion bundling is disabled/);
  } finally {
    process.env = original;
    fs.rmSync(path.join(directory, 'index.html'), {force: true});
    fs.rmdirSync(directory);
  }
});
