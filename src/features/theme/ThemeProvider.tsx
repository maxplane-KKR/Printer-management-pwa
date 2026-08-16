import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { DEFAULT_THEME, readThemeSettings, THEME_PRESETS, writeThemeSettings, type ThemePresetName, type ThemeSettings, type ThemeSurface } from './theme-config';

interface ThemeContextValue {
  settings: ThemeSettings;
  customImageUrl: string;
  setPreset: (preset: ThemePresetName) => void;
  setSurface: (surface: ThemeSurface) => void;
  setOpacity: (opacity: number) => void;
  setBlur: (blur: number) => void;
  setCustomImage: (file: File | null) => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<ThemeSettings>(() => readThemeSettings());
  const [customImageUrl, setCustomImageUrl] = useState('');

  useEffect(() => {
    writeThemeSettings(settings);
    const root = document.documentElement;
    const preset = THEME_PRESETS[settings.preset];
    root.dataset.surface = settings.surface;
    root.dataset.theme = settings.preset.toLowerCase();
    root.style.setProperty('--accent', preset.accent);
    root.style.setProperty('--accent-strong', preset.accent2);
    root.style.setProperty('--accent-glow', preset.glow);
    root.style.setProperty('--glass-opacity', `${settings.opacity / 100}`);
    root.style.setProperty('--glass-blur', `${settings.blur}px`);
  }, [settings]);

  useEffect(() => () => { if (customImageUrl) URL.revokeObjectURL(customImageUrl); }, [customImageUrl]);

  const value = useMemo<ThemeContextValue>(() => ({
    settings,
    customImageUrl,
    setPreset: (preset) => setSettings((current) => ({ ...current, preset })),
    setSurface: (surface) => setSettings((current) => ({ ...current, surface })),
    setOpacity: (opacity) => setSettings((current) => ({ ...current, opacity: Math.min(100, Math.max(40, opacity)) })),
    setBlur: (blur) => setSettings((current) => ({ ...current, blur: Math.min(30, Math.max(0, blur)) })),
    setCustomImage: (file) => {
      setCustomImageUrl((oldUrl) => { if (oldUrl) URL.revokeObjectURL(oldUrl); return file ? URL.createObjectURL(file) : ''; });
    },
    reset: () => { setCustomImageUrl((oldUrl) => { if (oldUrl) URL.revokeObjectURL(oldUrl); return ''; }); setSettings(DEFAULT_THEME); },
  }), [customImageUrl, settings]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
