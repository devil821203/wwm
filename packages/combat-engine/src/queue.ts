export type Timed = { atMs: number; sequence: number };
export class EventQueue<T extends Timed> {
  private heap: T[] = [];
  get size() {
    return this.heap.length;
  }
  private before(a: T, b: T) {
    return a.atMs < b.atMs || (a.atMs === b.atMs && a.sequence < b.sequence);
  }
  push(value: T) {
    if (
      !Number.isSafeInteger(value.atMs) ||
      value.atMs < 0 ||
      !Number.isSafeInteger(value.sequence) ||
      value.sequence < 0
    )
      throw new Error('事件時間/序號必須為非負安全整數');
    this.heap.push(value);
    let i = this.heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(this.heap[i], this.heap[parent])) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
      i = parent;
    }
  }
  pop(): T | undefined {
    const first = this.heap[0],
      last = this.heap.pop();
    if (!this.heap.length) return first;
    this.heap[0] = last!;
    let i = 0;
    while (true) {
      const left = i * 2 + 1,
        right = left + 1;
      let next = i;
      if (
        left < this.heap.length &&
        this.before(this.heap[left], this.heap[next])
      )
        next = left;
      if (
        right < this.heap.length &&
        this.before(this.heap[right], this.heap[next])
      )
        next = right;
      if (next === i) break;
      [this.heap[i], this.heap[next]] = [this.heap[next], this.heap[i]];
      i = next;
    }
    return first;
  }
}
