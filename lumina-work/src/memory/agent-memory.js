export class AgentMemory {
  constructor(agentId, compressEvery = 10) {
    this.agentId = agentId;
    this.compressEvery = compressEvery;
    this.turns = [];
  }

  add(entry) {
    this.turns.push({ ...entry, timestamp: Date.now() });
    if (this.turns.length > this.compressEvery * 3) {
      this._compress();
    }
  }

  getContext() {
    return this.turns.slice(-6);
  }

  getFull() {
    return this.turns;
  }

  _compress() {
    const recent = this.turns.slice(-this.compressEvery);
    const old = this.turns.slice(0, -this.compressEvery);
    const summary = old
      .map(t => (t.role === 'user' ? 'Q: ' : 'A: ') + (t.content || '').slice(0, 120))
      .join(' | ');
    this.turns = [
      { role: 'system', content: '[Earlier context: ' + summary.slice(0, 256) + ']', isMemory: true },
      ...recent
    ];
  }

  clear() {
    this.turns = [];
  }
}
