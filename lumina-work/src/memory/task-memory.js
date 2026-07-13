export class TaskMemory {
  constructor() {
    this.tasks = [];
  }

  add(task) {
    this.tasks.push(task);
  }

  getActive() {
    return this.tasks.filter(t => t.state !== 'done' && t.state !== 'approved');
  }

  getCompleted() {
    return this.tasks.filter(t => t.state === 'done' || t.state === 'approved');
  }

  getByDepartment(deptKey) {
    return this.tasks.filter(t =>
      t.messages?.some(m => m.dept === deptKey)
    );
  }

  getAll() {
    return this.tasks;
  }

  getTask(id) {
    return this.tasks.find(t => t.id === id);
  }

  getRecent(count = 5) {
    return this.tasks.slice(-count);
  }
}
