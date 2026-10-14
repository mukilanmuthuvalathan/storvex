// Mutating local-only integration check: recreates this project's Docker gateway.
// Existing objects are read and verified; only one uniquely named test object is deleted.
const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const path = require('node:path');
const run = promisify(execFile);
const root = path.resolve(__dirname, '..');
const base = process.env.STORVEX_TEST_URL || 'http://localhost:8180';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
  throw new Error('Docker persistence checks must target a local gateway.');
}
const key = 'persistence-tests/' + randomUUID() + '.txt';
const endpoint = (objectKey) => base + '/api/objects/' + encodeURIComponent(objectKey);
const request = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
async function catalog() {
  const response = await request(base + '/api/objects');
  assert.equal(response.status, 200);
  return (await response.json()).objects;
}
async function verifyObjects(expected) {
  const current = new Map((await catalog()).map((object) => [object.key, object]));
  for (const object of expected) {
    const recovered = current.get(object.key);
    assert.ok(recovered, 'Object preserved: ' + object.key);
    assert.equal(recovered.checksum, object.checksum, 'Manifest checksum preserved: ' + object.key);
    const response = await request(endpoint(object.key));
    assert.equal(response.status, 200, 'Read succeeds: ' + object.key);
    const hash = createHash('sha256');
    for await (const chunk of response.body) hash.update(chunk);
    assert.equal(hash.digest('hex'), object.checksum, 'Bytes verified: ' + object.key);
  }
}
async function compose(args) {
  const result = await run('docker', ['compose', '--env-file', '.env.docker.local', ...args], {
    cwd: root, timeout: 55000, maxBuffer: 1024 * 1024,
  });
  process.stdout.write(result.stdout);
  process.stdout.write(result.stderr);
}
(async () => {
  let created = false;
  try {
    const inspection = JSON.parse((await run('docker', ['inspect', 'storvex-gateway'], { cwd: root, timeout: 10000 })).stdout)[0];
    const normalize = (value) => path.resolve(value).toLowerCase();
    assert.equal(normalize(inspection.Config.Labels['com.docker.compose.project.working_dir']), normalize(root), 'Only operate on this project');
    assert.ok(inspection.Mounts.some((mount) => mount.Type === 'bind' && mount.Destination === '/app/data' && normalize(mount.Source) === normalize(path.join(root, 'data'))), 'Existing data folder is persistent');
    assert.equal(inspection.HostConfig.RestartPolicy.Name, 'unless-stopped');
    const existing = await catalog();
    await verifyObjects(existing);
    const content = Buffer.from('Storvex persistent Docker proof: ' + randomUUID());
    const response = await request(base + '/api/objects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, data: content.toString('base64'), contentType: 'text/plain' }),
    });
    assert.equal(response.status, 201);
    created = true;
    const record = (await response.json()).object;
    await compose(['restart', 'storvex']);
    await compose(['up', '-d', '--no-build', '--wait', '--wait-timeout', '45', 'storvex']);
    await verifyObjects([...existing, record]);
    console.log('PASS: container restart preserves all objects and verified bytes.');
    await compose(['up', '-d', '--force-recreate', '--no-build', '--wait', '--wait-timeout', '45', 'storvex']);
    await verifyObjects([...existing, record]);
    console.log('PASS: container recreation preserves ' + existing.length + ' existing objects plus the disposable test object.');
  } finally {
    if (created) {
      const response = await request(endpoint(key), { method: 'DELETE' });
      assert.ok([202, 404].includes(response.status), 'Cleanup only the disposable test object');
    }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
