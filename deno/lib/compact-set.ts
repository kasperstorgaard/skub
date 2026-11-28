/**
 * Open-addressing hash set for non-negative numeric keys.
 *
 * Backed by Float64Array — keys are stored inline at 8 bytes each instead of
 * as heap objects, giving ~6x less memory than Set<number> and better cache
 * locality on lookups.
 *
 * Uses -1 as the empty sentinel, so all keys must be ≥ 0.
 * Load factor is capped at 50% to keep average probe length near 1.5.
 */
export class CompactSet {
  private data: Float64Array;
  private mask: number;
  size = 0;

  constructor(initialCapacity = 1024) {
    let cap = 1;
    while (cap < initialCapacity) cap <<= 1;
    this.data = new Float64Array(cap).fill(-1);
    this.mask = cap - 1;
  }

  has(key: number): boolean {
    let i = this.hash(key);
    while (this.data[i] !== -1) {
      if (this.data[i] === key) return true;
      i = (i + 1) & this.mask;
    }
    return false;
  }

  add(key: number): void {
    if (this.size > (this.mask >> 1)) this.grow();
    let i = this.hash(key);
    while (this.data[i] !== -1) {
      if (this.data[i] === key) return;
      i = (i + 1) & this.mask;
    }
    this.data[i] = key;
    this.size++;
  }

  private hash(key: number): number {
    // Mix hi/lo 32-bit halves for keys > 2^32, then Fibonacci scatter
    const lo = key >>> 0;
    const hi = (key / 0x100000000) | 0;
    return (Math.imul(lo ^ hi, 0x9e3779b9) >>> 0) & this.mask;
  }

  private grow(): void {
    const old = this.data;
    const newCap = (this.mask + 1) << 1;
    this.data = new Float64Array(newCap).fill(-1);
    this.mask = newCap - 1;
    this.size = 0;
    for (let i = 0; i < old.length; i++) {
      if (old[i] !== -1) this.add(old[i]);
    }
  }
}
