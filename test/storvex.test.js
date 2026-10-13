import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorvexCluster } from '../src/core/storvex-engine.js';

const directories = [];
let storvex;

beforeEach(async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'storvex-test-'));
  directories.push(rootDir);
  storvex = await new StorvexCluster({ rootDir }).init();
});

afterEach(async () => {
  await storvex?.close();
});

after(async () => {
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('StorvexCluster', () => {
  test('stores an object across failure domains and retrieves identical bytes', async () => {
    const content = Buffer.from('mission critical payload');
    const record = await storvex.putObject('missions/alpha.bin', content);
    assert.equal(record.replicas.length, 3);
    assert.equal(new Set(record.replicas.map((id) => storvex.nodes.get(id).zone)).size, 3);
    const retrieved = await storvex.getObject('missions/alpha.bin');
    assert.deepEqual(retrieved.buffer, content);
  });

  test('remains available after a replica node fails', async () => {
    const record = await storvex.putObject('logs/audit.jsonl', Buffer.from('{"ok":true}\n'));
    storvex.setNodeStatus(record.replicas[0], 'offline');
    const retrieved = await storvex.getObject('logs/audit.jsonl');
    assert.equal(retrieved.buffer.toString(), '{"ok":true}\n');
    assert.equal(storvex.listObjects()[0].health, 'degraded');
  });

  test('uses independent storage-node processes for replicated data', async () => {
    await storvex.close();
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'storvex-distributed-test-'));
    directories.push(rootDir);
    const storageBasePort = 13000 + Math.floor(Math.random() * 1000);
    storvex = await new StorvexCluster({ rootDir, nodes: 3, storageMode: 'http', manageStorageNodes: true, storageBasePort }).init();

    const content = Buffer.from('served by independent node processes');
    const record = await storvex.putObject('distributed/process-proof.bin', content);
    const failedNode = record.replicas[0];
    const failedIndex = Number(failedNode.split('-').at(-1)) - 1;
    storvex.storageNodeProcesses[failedIndex].kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 250));
    await storvex.refreshNodeHealth();

    assert.equal(storvex.nodes.get(failedNode).status, 'partitioned');
    const retrieved = await storvex.getObject(record.key);
    assert.deepEqual(retrieved.buffer, content);
  });

  test('recovers managed storage processes before failing a read', async () => {
    await storvex.close();
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'storvex-read-recovery-test-'));
    directories.push(rootDir);
    const storageBasePort = 15000 + Math.floor(Math.random() * 1000);
    storvex = await new StorvexCluster({ rootDir, nodes: 3, storageMode: 'http', manageStorageNodes: true, storageBasePort }).init();

    const content = Buffer.from('read recovery after upload');
    const record = await storvex.putObject('uploads/recover-before-read.txt', content);
    for (const nodeId of record.replicas) storvex.setNodeStatus(nodeId, 'offline');

    const retrieved = await storvex.getObject(record.key);
    assert.deepEqual(retrieved.buffer, content);
    assert.equal(record.replicas.every((nodeId) => storvex.nodes.get(nodeId).status === 'healthy'), true);
  });

  test('detects corruption and reconstructs the bad replica', async () => {
    const original = Buffer.from('checksum-protected-content');
    const record = await storvex.putObject('backups/checkpoint.snap', original);
    await storvex.corruptReplica(record.key, record.replicas[0]);
    const report = await storvex.integrityScan();
    assert.equal(report.degraded, 1);
    assert.equal(report.repaired, 1);
    const retrieved = await storvex.getObject(record.key);
    assert.deepEqual(retrieved.buffer, original);
  });

  test('serializes concurrent writes and preserves monotonic versions', async () => {
    await Promise.all(Array.from({ length: 12 }, (_, index) => storvex.putObject('concurrent/key', Buffer.from(`version-${index}`))));
    const [record] = storvex.listObjects();
    assert.equal(record.version, 12);
    assert.equal(record.replicas.length, 3);
  });

  test('rejects a quorum policy that cannot guarantee consistency', async () => {
    await assert.rejects(
      storvex.putObject('unsafe/key', Buffer.from('unsafe'), { policy: { replicationFactor: 3, readQuorum: 1, writeQuorum: 2 } }),
      (error) => error.code === 'UNSAFE_POLICY',
    );
  });
});
