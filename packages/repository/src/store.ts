export interface KeyValueStore {
  get(key: string): string | undefined;
  getMany(keys: string[]): Record<string, string | undefined>;
  set(key: string, value: string): void;
  delete(key: string): void;
  listKeys(): string[];
  /** 返回取消订阅函数。 */
  onChange(listener: (key: string, newValue: string | null) => void): () => void;
  /** 估算已用字节数（可选，用于容量提示）。 */
  usedBytes?(): number;
}

const MEMORY_LISTENERS = new WeakMap<MemoryKeyValueStore, Set<(k: string, v: string | null) => void>>();

function emitMemory(store: MemoryKeyValueStore, key: string, newValue: string | null) {
  const set = MEMORY_LISTENERS.get(store);
  if (!set) return;
  for (const fn of Array.from(set)) {
    try {
      fn(key, newValue);
    } catch {
      // listener errors never break storage
    }
  }
}

/**
 * 内存 KV 实现，用于测试与无 GM 环境（例如纯 dashboard 开发）。
 */
export class MemoryKeyValueStore implements KeyValueStore {
  private map = new Map<string, string>();

  get(key: string): string | undefined {
    return this.map.get(key);
  }

  getMany(keys: string[]): Record<string, string | undefined> {
    const out: Record<string, string | undefined> = {};
    for (const k of keys) out[k] = this.map.get(k);
    return out;
  }

  set(key: string, value: string): void {
    this.map.set(key, value);
    emitMemory(this, key, value);
  }

  delete(key: string): void {
    if (this.map.delete(key)) emitMemory(this, key, null);
  }

  listKeys(): string[] {
    return Array.from(this.map.keys());
  }

  onChange(listener: (key: string, newValue: string | null) => void): () => void {
    let set = MEMORY_LISTENERS.get(this);
    if (!set) {
      set = new Set();
      MEMORY_LISTENERS.set(this, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  usedBytes(): number {
    let total = 0;
    for (const [, v] of this.map) total += v.length * 2;
    return total;
  }
}

/**
 * Tampermonkey GM_* 存储适配器。
 */
export interface GMApi {
  getValue(key: string, def?: unknown): unknown;
  getValues(keys: string[]): Record<string, unknown>;
  setValue(key: string, value: unknown): void;
  deleteValue(key: string): void;
  listValues(): string[];
  addValueChangeListener?(key: string, listener: (key: string, oldValue: unknown, newValue: unknown) => void): number;
  removeValueChangeListener?(id: number): void;
}

export class GMKeyValueStore implements KeyValueStore {
  private local = new Map<string, string>();

  constructor(private gm: GMApi) {}

  get(key: string): string | undefined {
    try {
      const v = this.gm.getValue(key);
      return v === undefined || v === null ? undefined : String(v);
    } catch {
      return this.local.get(key);
    }
  }

  getMany(keys: string[]): Record<string, string | undefined> {
    const out: Record<string, string | undefined> = {};
    if (typeof this.gm.getValues === 'function') {
      try {
        const vals = this.gm.getValues(keys);
        for (const k of keys) {
          const v = vals[k];
          out[k] = v === undefined || v === null ? undefined : String(v);
        }
        return out;
      } catch {
        /* fall through */
      }
    }
    for (const k of keys) out[k] = this.get(k);
    return out;
  }

  set(key: string, value: string): void {
    try {
      this.gm.setValue(key, value);
      this.local.set(key, value);
    } catch (e) {
      throw new Error(`GM storage write failed for ${key}: ${(e as Error).message}`);
    }
    this.emitLocal(key, value);
  }

  delete(key: string): void {
    try {
      this.gm.deleteValue(key);
      this.local.delete(key);
    } catch (e) {
      throw new Error(`GM storage delete failed for ${key}: ${(e as Error).message}`);
    }
    this.emitLocal(key, null);
  }

  listKeys(): string[] {
    try {
      return this.gm.listValues();
    } catch {
      return Array.from(this.local.keys());
    }
  }

  onChange(listener: (key: string, newValue: string | null) => void): () => void {
    let gmId: number | null = null;
    if (this.gm.addValueChangeListener) {
      try {
        gmId = this.gm.addValueChangeListener(
          'bf:revision',
          (key: string, oldValue: unknown, newValue: unknown) => {
            void oldValue;
            listener(key, newValue === undefined || newValue === null ? null : String(newValue));
          },
        );
      } catch {
        gmId = null;
      }
    }
    const localListener = (key: string, newValue: string | null) => {
      if (key === 'bf:revision') listener(key, newValue);
    };
    const local = this.onLocalChange(localListener);
    return () => {
      local();
      if (gmId !== null && this.gm.removeValueChangeListener) {
        try {
          this.gm.removeValueChangeListener(gmId);
        } catch {
          /* noop */
        }
      }
    };
  }

  usedBytes(): number {
    let total = 0;
    for (const [, v] of this.local) total += v.length * 2;
    return total;
  }

  private localListeners = new Map<string, Set<(k: string, v: string | null) => void>>();

  private onLocalChange(listener: (k: string, v: string | null) => void): () => void {
    let set = this.localListeners.get('bf:revision');
    if (!set) {
      set = new Set();
      this.localListeners.set('bf:revision', set);
    }
    set.add(listener);
    return () => set.delete(listener);
  }

  private emitLocal(key: string, newValue: string | null) {
    const set = this.localListeners.get(key);
    if (!set) return;
    for (const fn of Array.from(set)) fn(key, newValue);
  }
}

export function createMemoryStore(): KeyValueStore {
  return new MemoryKeyValueStore();
}

export function createGMStore(gm: GMApi): KeyValueStore {
  return new GMKeyValueStore(gm);
}
