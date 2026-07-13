export class CompanyMemory {
  constructor() {
    this.log = [];
    this.summaries = [];
  }

  logEvent(event) {
    this.log.push({ ...event, timestamp: Date.now() });
  }

  getRecent(count = 10) {
    return this.log.slice(-count);
  }

  addSummary(summary) {
    this.summaries.push({ content: summary, timestamp: Date.now() });
    if (this.summaries.length > 20) this.summaries = this.summaries.slice(-20);
  }

  getContext() {
    const recent = this.log.slice(-5).map(e => e.message || e.description || '').join(' | ');
    const summary = this.summaries.slice(-3).map(s => s.content).join(' | ');
    return {
      recentLog: recent,
      summaries: summary,
      eventCount: this.log.length
    };
  }

  clear() {
    this.log = [];
    this.summaries = [];
  }
}
