export type ThemePresetName = 'Mint' | 'Neon' | 'Rose' | 'Sunset' | 'Netflix' | 'Luxury';
export type ThemeSurface = 'dark' | 'light';

export interface ThemeSettings {
  preset: ThemePresetName;
  surface: ThemeSurface;
  opacity: number;
  blur: number;
}

export const DEFAULT_THEME: ThemeSettings = { preset: 'Netflix', surface: 'dark', opacity: 88, blur: 12 };
export const THEME_PRESETS: Record<ThemePresetName, { accent: string; accent2: string; glow: string; label: string }> = {
  Mint: { accent: '#21d4b4', accent2: '#9fffe7', glow: '#0d8c82', label: 'Mint' },
  Neon: { accent: '#a8ff00', accent2: '#70e7ff', glow: '#456d00', label: 'Neon' },
  Rose: { accent: '#ff5c8a', accent2: '#ffb3cc', glow: '#922344', label: 'Rose' },
  Sunset: { accent: '#ff8a3d', accent2: '#ffd166', glow: '#a23d21', label: 'Sunset' },
  Netflix: { accent: '#e50914', accent2: '#ff5c66', glow: '#7f1118', label: 'Netflix' },
  Luxury: { accent: '#d6b56c', accent2: '#f2dfae', glow: '#745b25', label: 'Luxury' },
};

const STORAGE_KEY = 'printerThemeSettings';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function readThemeSettings(storage: Storage = localStorage): ThemeSettings {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null') as Partial<ThemeSettings> | null;
    const preset = value?.preset && value.preset in THEME_PRESETS ? value.preset : DEFAULT_THEME.preset;
    const surface = value?.surface === 'light' ? 'light' : DEFAULT_THEME.surface;
    return { preset, surface, opacity: clamp(Number(value?.opacity ?? DEFAULT_THEME.opacity), 40, 100), blur: clamp(Number(value?.blur ?? DEFAULT_THEME.blur), 0, 30) };
  } catch { return DEFAULT_THEME; }
}

export function writeThemeSettings(settings: ThemeSettings, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, opacity: clamp(settings.opacity, 40, 100), blur: clamp(settings.blur, 0, 30) }));
}
