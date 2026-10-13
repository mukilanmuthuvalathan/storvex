export class PlacementEngine {
  select(nodes, count) {
    const candidates = [...nodes].filter((node) => node.status === 'healthy');
    candidates.sort((a, b) => a.usedBytes - b.usedBytes || a.latencyMs - b.latencyMs || a.id.localeCompare(b.id));
    const selected = [];
    const zones = new Set();
    for (const node of candidates) {
      if (!zones.has(node.zone) && selected.length < count) {
        selected.push(node);
        zones.add(node.zone);
      }
    }
    for (const node of candidates) if (!selected.includes(node) && selected.length < count) selected.push(node);
    return selected;
  }
}
