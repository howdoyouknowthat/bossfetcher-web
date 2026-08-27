import type { KeyValueStore } from '@bossfetcher/repository';
import { createGMStore } from '@bossfetcher/repository';

declare function GM_getValue(key: string, def?: unknown): unknown;
declare function GM_getValues(keys: string[]): Record<string, unknown>;
declare function GM_setValue(key: string, value: unknown): void;
declare function GM_deleteValue(key: string): void;
declare function GM_listValues(): string[];
declare function GM_addValueChangeListener(key: string, cb: (key: string, oldVal: unknown, newVal: unknown) => void): number;
declare function GM_removeValueChangeListener(id: number): void;

/** 单一真源：Tampermonkey GM_* API 映射，所有入口统一调用此函数。 */
export function createBossFetcherStore(): KeyValueStore {
  return createGMStore({
    getValue: (k, d) => GM_getValue(k, d),
    getValues: (keys) => GM_getValues(keys),
    setValue: (k, v) => GM_setValue(k, v),
    deleteValue: (k) => GM_deleteValue(k),
    listValues: () => GM_listValues(),
    addValueChangeListener: (k, cb) => GM_addValueChangeListener(k, cb),
    removeValueChangeListener: (id) => GM_removeValueChangeListener(id),
  });
}