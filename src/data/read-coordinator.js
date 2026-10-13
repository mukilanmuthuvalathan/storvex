import { readFile } from 'node:fs/promises';

export class ReadCoordinator {
  constructor({ checksum }) {
    this.checksum = checksum;
  }

  async read({ record, nodes, replicaPath, readReplica }) {
    const candidates = record.replicas.map((id) => nodes.get(id)).filter((node) => node?.status === 'healthy');
    if (candidates.length < record.policy.readQuorum) return { quorumAvailable: false, valid: [], damaged: [] };
    const results = await Promise.all(candidates.map(async (node) => {
      try {
        const buffer = readReplica
          ? await readReplica(node)
          : await readFile(replicaPath(node, record.key, record.version));
        const checksum = this.checksum(buffer);
        return { node, buffer, checksum, valid: checksum === record.checksum };
      } catch {
        return { node, buffer: null, checksum: null, valid: false };
      }
    }));
    return {
      quorumAvailable: true,
      valid: results.filter((entry) => entry.valid),
      damaged: results.filter((entry) => !entry.valid),
    };
  }
}
