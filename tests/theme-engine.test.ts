import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, readThemeSettings, THEME_PRESETS, writeThemeSettings } from '../src/features/theme/theme-config';

describe('theme engine', () => {
  it('เริ่มต้น Netflix dark glass 88/12', () => {
    expect(DEFAULT_THEME).toEqual({ preset: 'Netflix', surface: 'dark', opacity: 88, blur: 12 });
    expect(Object.keys(THEME_PRESETS)).toEqual(['Mint', 'Neon', 'Rose', 'Sunset', 'Netflix', 'Luxury']);
  });
  it('clamp ค่า opacity/blur และ persist เฉพาะ settings', () => {
    const storage = new Map<string, string>();
    const fakeStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); }, removeItem: (key: string) => { storage.delete(key); }, clear: () => storage.clear(), key: (index: number) => Array.from(storage.keys())[index] ?? null, length: 0 } as unknown as Storage;
    writeThemeSettings({ preset: 'Netflix', surface: 'dark', opacity: 140, blur: -3 }, fakeStorage);
    expect(readThemeSettings(fakeStorage)).toMatchObject({ opacity: 100, blur: 0 });
    expect(storage.get('printerThemeSettings')).not.toContain('blob:');
  });
});
