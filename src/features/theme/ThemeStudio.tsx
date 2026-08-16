import { useRef } from 'react';
import { THEME_PRESETS, type ThemePresetName } from './theme-config';
import { useTheme } from './ThemeProvider';

interface ThemeStudioProps { open: boolean; onClose: () => void }

export function ThemeStudio({ open, onClose }: ThemeStudioProps) {
  const { settings, customImageUrl, setPreset, setSurface, setOpacity, setBlur, setCustomImage, reset } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="theme-studio" role="dialog" aria-modal="true" aria-labelledby="theme-studio-title">
        <div className="modal-head">
          <div><span className="eyebrow">APPEARANCE SYSTEM</span><h2 id="theme-studio-title">Theme Studio</h2><p>ปรับ command center ให้เข้ากับทีมของคุณ</p></div>
          <button className="icon-button" aria-label="ปิด Theme Studio" onClick={onClose}>×</button>
        </div>
        <div className="theme-studio__body">
          <div className="theme-preview" style={customImageUrl ? { backgroundImage: `linear-gradient(135deg, rgba(7,9,13,.35), rgba(7,9,13,.85)), url("${customImageUrl}")` } : undefined}>
            <div className="theme-preview__top"><span className="status-dot online" /> Live preview <span>{settings.opacity}% glass</span></div>
            <div><span className="eyebrow">NETFLIX DARK GLASS</span><strong>Fleet command, tuned.</strong><p>ทุกสถานะสำคัญในสายตาเดียว</p></div>
            <div className="preview-meter"><i style={{ width: '72%' }} /></div>
          </div>
          <div className="theme-controls">
            <div className="control-block"><div className="control-heading"><label>Preset</label><span>6 styles</span></div><div className="preset-grid" role="group" aria-label="เลือก preset ธีม">
              {(Object.keys(THEME_PRESETS) as ThemePresetName[]).map((name) => <button key={name} className={`preset-chip ${settings.preset === name ? 'is-active' : ''}`} aria-pressed={settings.preset === name} onClick={() => setPreset(name)}><i style={{ background: THEME_PRESETS[name].accent }} />{name}</button>)}
            </div></div>
            <div className="control-block"><div className="control-heading"><label>Surface</label><span>{settings.surface === 'dark' ? 'Dark Glass' : 'Light Glass'}</span></div><div className="segmented"><button aria-pressed={settings.surface === 'dark'} className={settings.surface === 'dark' ? 'is-active' : ''} onClick={() => setSurface('dark')}>Dark Glass</button><button aria-pressed={settings.surface === 'light'} className={settings.surface === 'light' ? 'is-active' : ''} onClick={() => setSurface('light')}>Light Glass</button></div></div>
            <div className="control-block range-control"><div className="control-heading"><label htmlFor="card-opacity">ความทึบของการ์ด</label><output>{settings.opacity}%</output></div><input id="card-opacity" aria-label="ความทึบของการ์ด" type="range" min="40" max="100" value={settings.opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></div>
            <div className="control-block range-control"><div className="control-heading"><label htmlFor="card-blur">ความเบลอพื้นหลัง</label><output>{settings.blur}px</output></div><input id="card-blur" aria-label="ความเบลอพื้นหลัง" type="range" min="0" max="30" value={settings.blur} onChange={(event) => setBlur(Number(event.target.value))} /></div>
            <div className="control-block upload-control"><div className="control-heading"><label htmlFor="theme-image">รูปพื้นหลังการ์ด</label><span>session only</span></div><input ref={fileRef} id="theme-image" aria-label="รูปพื้นหลังการ์ด" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setCustomImage(event.target.files?.[0] ?? null)} />{customImageUrl && <button className="text-button" onClick={() => setCustomImage(null)}>เอารูปออก</button>}</div>
          </div>
        </div>
        <div className="modal-foot"><span className="live-note" aria-live="polite"><span className="status-dot online" /> บันทึกอัตโนมัติในเครื่อง</span><div><button className="ghost-button" onClick={reset}>คืนค่าเริ่มต้น</button><button className="primary-button" onClick={onClose}>ใช้ธีมนี้</button></div></div>
      </section>
    </div>
  );
}
