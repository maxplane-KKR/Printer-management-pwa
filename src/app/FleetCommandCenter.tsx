import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../features/theme/ThemeProvider';
import { ThemeStudio } from '../features/theme/ThemeStudio';
import { PrinterEditor } from '../features/printers/PrinterEditor';
import { applyTcpResults, buildTcpScanScript, parseTcpResults } from '../features/tools/tcp-tools';
import { getExportFilename, serializePrintersCsv } from '../features/tools/csv-tools';
import { createPrinterApi, type PrinterApi } from '../services/printers-api';
import { createPrinterCache, type PrinterCache } from '../services/printer-cache';
import { migrateLegacyPrinterCache } from '../services/legacy-cache-migration';
import type { Printer } from '../types/printer';

type View = 'manage' | 'list';
type StatusFilter = 'all' | 'online' | 'offline' | 'warning' | 'maintenance';
type SortKey = 'name' | 'location' | 'status' | 'lastUpdated';

const SEED_PRINTERS: Printer[] = [
  { id: 'p-001', name: 'Finance · Ricoh C4503', ip: '10.20.4.18', location: 'สำนักงานใหญ่ / ชั้น 2', type: 'MFP สี', status: 'online', lastUpdated: '2026-08-16T08:05:00.000Z', note: 'พร้อมใช้งาน' },
  { id: 'p-002', name: 'HR · Xerox C7030', ip: '10.20.4.22', location: 'สำนักงานใหญ่ / ชั้น 3', type: 'MFP สี', status: 'online', lastUpdated: '2026-08-16T08:04:00.000Z', note: '' },
  { id: 'p-003', name: 'Operations · HP M607', ip: '10.20.5.11', location: 'คลังสินค้า / A1', type: 'Laser ขาวดำ', status: 'warning', lastUpdated: '2026-08-16T07:42:00.000Z', note: 'หมึกเหลือน้อย' },
  { id: 'p-004', name: 'Design · Canon C5840', ip: '10.20.7.41', location: 'สตูดิโอ / ชั้น 4', type: 'MFP สี', status: 'online', lastUpdated: '2026-08-16T08:01:00.000Z', note: '' },
  { id: 'p-005', name: 'Reception · Brother 6490', ip: '10.20.1.9', location: 'Lobby / ชั้น 1', type: 'Inkjet', status: 'offline', lastUpdated: '2026-08-16T06:18:00.000Z', note: 'ตรวจสาย LAN' },
  { id: 'p-006', name: 'Legal · Kyocera 3554', ip: '10.20.3.33', location: 'สำนักงานใหญ่ / ชั้น 5', type: 'MFP สี', status: 'maintenance', lastUpdated: '2026-08-15T17:20:00.000Z', note: 'นัดช่าง 13:00' },
  { id: 'p-007', name: 'Sales · HP M404', ip: '10.20.2.14', location: 'สำนักงานใหญ่ / ชั้น 2', type: 'Laser ขาวดำ', status: 'online', lastUpdated: '2026-08-16T08:03:00.000Z', note: '' },
  { id: 'p-008', name: 'Warehouse · Zebra ZT411', ip: '10.20.5.46', location: 'คลังสินค้า / B2', type: 'Label', status: 'online', lastUpdated: '2026-08-16T07:58:00.000Z', note: '' },
];

const STATUS_LABEL: Record<string, string> = { online: 'Online', offline: 'Offline', warning: 'Warning', maintenance: 'Maintenance' };
const STATUS_TONE: Record<string, string> = { online: 'online', offline: 'offline', warning: 'warning', maintenance: 'maintenance' };
const fmtTime = (value: string) => value ? new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';

function Icon({ name }: { name: 'grid' | 'list' | 'plus' | 'search' | 'sliders' | 'download' | 'refresh' | 'settings' | 'more' | 'trash' | 'edit' | 'copy' | 'sun' | 'moon' | 'wifi' | 'check' }) {
  const paths: Record<string, string> = { grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', list: 'M4 6h16M4 12h16M4 18h16', plus: 'M12 5v14M5 12h14', search: 'm20 20-4.5-4.5M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z', sliders: 'M4 6h16M7 6v4M4 18h16M17 14v4M4 12h16M12 10v4', download: 'M12 4v11m0 0 4-4m-4 4-4-4M5 20h14', refresh: 'M20 11a8 8 0 1 0 1 4M20 5v6h-6', settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-2.5V20a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6v-2.5h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V4h2.5v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 .1.0', more: 'M5 12h.01M12 12h.01M19 12h.01', trash: 'M5 7h14m-9 4v5m4-5v5M9 7V5h6v2m-8 0 1 13h8l1-13', edit: 'm4 16 10-10 4 4L8 20H4zM13 7l4 4', copy: 'M8 8h10v12H8zM6 16H4V4h12v2', sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z', moon: 'M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z', wifi: 'M3 9a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9.5 15a4 4 0 0 1 5 0M12 19h.01', check: 'm5 12 4 4L19 6' };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

export function FleetCommandCenter() {
  const { settings } = useTheme();
  const [printers, setPrinters] = useState<Printer[]>(SEED_PRINTERS);
  const [view, setView] = useState<View>('manage');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [location, setLocation] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Printer | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [syncState, setSyncState] = useState<'offline' | 'syncing' | 'synced' | 'error'>('offline');
  const [lastSynced, setLastSynced] = useState('');
  const [notice, setNotice] = useState('');
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiRef = useRef<PrinterApi | null>(null);
  const cacheRef = useRef<PrinterCache | null>(null);

  useEffect(() => {
    apiRef.current = typeof fetch === 'function' ? createPrinterApi(fetch) : null;
    cacheRef.current = typeof indexedDB === 'undefined' ? null : createPrinterCache(indexedDB);
    let active = true;
    const start = async () => {
      if (cacheRef.current) {
        try {
          await migrateLegacyPrinterCache(localStorage, cacheRef.current);
          const cached = await cacheRef.current.load();
          if (cached.length && active) setPrinters(cached);
        } catch { /* local fallback remains usable */ }
      }
      if (apiRef.current) {
        try {
          const result = await apiRef.current.load();
          if (active && result.printers.length) setPrinters(result.printers);
          if (active) { setLastSynced(result.syncedAt || new Date().toISOString()); setSyncState('synced'); }
        } catch { if (active) setSyncState('offline'); }
      }
      if (active) setBusy(false);
    };
    void start();
    return () => { active = false; if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, []);

  const persist = (next: Printer[], queueSync = true) => {
    setPrinters(next);
    if (cacheRef.current) void cacheRef.current.save(next).catch(() => undefined);
    if (!queueSync || !apiRef.current) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setSyncState('syncing');
    syncTimer.current = setTimeout(() => { void apiRef.current?.save('syncPrinters', next).then(() => { setSyncState('synced'); setLastSynced(new Date().toISOString()); }).catch(() => setSyncState('error')); }, 650);
  };

  const locations = useMemo(() => Array.from(new Set(printers.map((printer) => printer.location))).sort(), [printers]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return printers.filter((printer) => (!term || `${printer.name} ${printer.ip} ${printer.location} ${printer.type}`.toLowerCase().includes(term)) && (status === 'all' || printer.status === status) && (location === 'all' || printer.location === location)).sort((a, b) => { const av = a[sortKey].toLowerCase(); const bv = b[sortKey].toLowerCase(); return (av.localeCompare(bv, 'th') || a.name.localeCompare(b.name, 'th')) * (sortAsc ? 1 : -1); });
  }, [location, printers, query, sortAsc, sortKey, status]);
  const stats = useMemo(() => ({ total: printers.length, online: printers.filter((p) => p.status === 'online').length, attention: printers.filter((p) => p.status === 'warning' || p.status === 'maintenance').length, offline: printers.filter((p) => p.status === 'offline').length }), [printers]);
  const health = stats.total ? Math.round((stats.online / stats.total) * 100) : 0;

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 3200); };
  const openAdd = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (printer: Printer) => { setEditing(printer); setEditorOpen(true); };
  const savePrinter = (printer: Printer) => { persist(printers.some((item) => item.id === printer.id) ? printers.map((item) => item.id === printer.id ? printer : item) : [printer, ...printers]); setEditorOpen(false); notify('บันทึกข้อมูลเครื่องพิมพ์แล้ว'); };
  const deleteIds = (ids: string[]) => { persist(printers.filter((printer) => !ids.includes(printer.id))); setSelected([]); setBulkConfirm(false); notify(`ลบเครื่องพิมพ์ ${ids.length} รายการแล้ว`); };
  const manualSync = async () => { if (!apiRef.current) { notify('โหมด local: ข้อมูลถูกเก็บไว้ในเครื่องแล้ว'); return; } setSyncState('syncing'); try { await apiRef.current.save('saveToSheet', printers); setSyncState('synced'); setLastSynced(new Date().toISOString()); notify('ส่งข้อมูลไปยังชีตแล้ว'); } catch { setSyncState('error'); notify('เชื่อมต่อชีตไม่ได้ ข้อมูลยังเก็บอยู่ในเครื่อง'); } };
  const exportCsv = () => { const blob = new Blob([serializePrintersCsv(printers)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = getExportFilename(); link.click(); URL.revokeObjectURL(url); notify('เตรียมไฟล์ CSV แล้ว'); };
  const runTcpScript = async () => { try { await navigator.clipboard.writeText(buildTcpScanScript(printers.map((printer) => printer.ip))); notify('คัดลอกสคริปต์ TCP แล้ว'); } catch { notify('คัดลอกไม่สำเร็จ — ใช้ปุ่มอีกครั้งหลังอนุญาต clipboard'); } };
  const importTcp = async () => { try { const raw = await navigator.clipboard.readText(); const result = applyTcpResults(printers, parseTcpResults(raw)); persist(result.printers); notify(`อัปเดตสถานะ ${result.updatedCount} รายการแล้ว`); } catch { notify('อ่านผล TCP ไม่สำเร็จ หรือ JSON ไม่ถูกต้อง'); } };
  const setSort = (key: SortKey) => { if (sortKey === key) setSortAsc((value) => !value); else { setSortKey(key); setSortAsc(true); } };
  const toggleSelected = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return <div className="app-shell">
    <aside className="side-rail"><div className="brand"><span className="brand-mark">P</span><div><strong>PRINTER<span>PRO</span></strong><small>FLEET COMMAND</small></div></div><div className="rail-label">WORKSPACE</div><nav><button className={view === 'manage' ? 'is-active' : ''} onClick={() => setView('manage')}><Icon name="grid" />ภาพรวม<span className="nav-badge">{stats.total}</span></button><button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}><Icon name="list" />เครื่องพิมพ์<span className="nav-badge">{stats.offline + stats.attention || ''}</span></button></nav><div className="rail-bottom"><button onClick={() => setThemeOpen(true)}><Icon name="settings" />Theme Studio</button><div className="operator"><span className="avatar">KK</span><span><strong>KKR Operations</strong><small>ผู้ดูแลระบบ</small></span><Icon name="more" /></div></div></aside>
    <div className="app-main"><header className="topbar"><div className="breadcrumb"><span className="mobile-brand">P</span><span>Workspace</span><b>/</b><strong>Fleet overview</strong></div><div className="topbar-actions"><span className={`sync-pill ${syncState}`}><i className="status-dot" />{syncState === 'syncing' ? 'กำลังซิงก์' : syncState === 'error' ? 'ซิงก์ไม่สำเร็จ' : syncState === 'synced' ? `อัปเดต ${fmtTime(lastSynced)}` : 'Local mode'}</span><button className="icon-button theme-toggle" aria-label="เปิด Theme Studio" onClick={() => setThemeOpen(true)}>{settings.surface === 'dark' ? <Icon name="moon" /> : <Icon name="sun" />}</button><button className="avatar avatar-button" aria-label="บัญชีผู้ใช้">KK</button></div></header>
      <main id="main-content"><div className="page-heading"><div><span className="eyebrow">SATURDAY · 16 AUGUST 2026</span><h1>Fleet overview</h1><p>ภาพรวมสุขภาพเครื่องพิมพ์ของคุณ <span className="live-indicator"><i className="status-dot online" />LIVE</span></p></div><div className="heading-actions"><button className="ghost-button" onClick={manualSync}><Icon name="refresh" />ซิงก์ข้อมูล</button><button className="primary-button" onClick={openAdd}><Icon name="plus" />เพิ่มเครื่องพิมพ์</button></div></div>
        {view === 'manage' && <section className="overview-grid"><div className="hero-card"><div className="hero-copy"><span className="eyebrow">NETWORK HEALTH</span><h2>Everything is<br /><em>connected.</em></h2><p>ระบบกำลังเฝ้าดู {stats.total} endpoints ใน fleet ของคุณ</p><div className="hero-actions"><button className="hero-button" onClick={() => setView('list')}>ดูรายการทั้งหมด <span>→</span></button><span className="last-check"><Icon name="wifi" /> ตรวจล่าสุด {fmtTime(lastSynced || new Date().toISOString())}</span></div></div><div className="health-ring" style={{ '--health': `${health * 3.6}deg` } as React.CSSProperties}><div><strong>{health}<small>%</small></strong><span>HEALTHY</span></div></div><div className="hero-noise" /></div><div className="metric-card metric-online"><span className="metric-icon"><Icon name="wifi" /></span><span className="metric-label">ONLINE NOW</span><strong>{stats.online}<small> / {stats.total}</small></strong><div className="metric-foot"><span className="trend-up">↑ 8.4%</span><span>vs last week</span></div></div><div className="metric-card metric-attention"><span className="metric-icon"><Icon name="refresh" /></span><span className="metric-label">NEEDS ATTENTION</span><strong>{stats.attention + stats.offline}</strong><div className="metric-foot"><span className="trend-warn">{stats.offline} offline</span><span>{stats.attention} warning</span></div></div></section>}
        <section className={`fleet-panel ${view === 'manage' ? '' : 'fleet-panel--full'}`}><div className="panel-heading"><div><span className="eyebrow">{view === 'manage' ? 'ALL ENDPOINTS' : 'PRINTER DIRECTORY'}</span><h2>{view === 'manage' ? 'Printer fleet' : 'เครื่องพิมพ์ทั้งหมด'} <span>{filtered.length}</span></h2></div><div className="panel-heading-actions"><button className="ghost-button small" onClick={() => setToolsOpen((value) => !value)}><Icon name="sliders" />Tools</button><button className="icon-button"><Icon name="more" /></button></div></div><div className="filter-bar"><label className="search-box"><Icon name="search" /><input aria-label="ค้นหาเครื่องพิมพ์" placeholder="ค้นหาชื่อ, IP, สถานที่..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="กรองสถานะ" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}><option value="all">ทุกสถานะ</option><option value="online">Online</option><option value="warning">Warning</option><option value="offline">Offline</option><option value="maintenance">Maintenance</option></select><select aria-label="กรองสถานที่" value={location} onChange={(event) => setLocation(event.target.value)}><option value="all">ทุกสถานที่</option>{locations.map((item) => <option key={item} value={item}>{item}</option>)}</select>{selected.length > 0 && <button className="danger-button bulk-button" onClick={() => setBulkConfirm(true)}><Icon name="trash" />ลบ {selected.length}</button>}</div>{toolsOpen && <div className="tools-strip"><button onClick={manualSync}><Icon name="refresh" />ซิงก์กับชีต</button><button onClick={exportCsv}><Icon name="download" />Export CSV</button><button onClick={runTcpScript}><Icon name="copy" />คัดลอกสคริปต์ TCP</button><button onClick={importTcp}><Icon name="wifi" />อัปเดตสถานะจาก clipboard</button></div>}<div className="table-wrap"><table><thead><tr><th className="check-cell"><input type="checkbox" aria-label="เลือกทั้งหมด" checked={selected.length > 0 && selected.length === filtered.length} onChange={() => setSelected(selected.length === filtered.length ? [] : filtered.map((printer) => printer.id))} /></th><th><button onClick={() => setSort('name')}>เครื่องพิมพ์ <span>↕</span></button></th><th><button onClick={() => setSort('location')}>สถานที่ <span>↕</span></button></th><th>ประเภท</th><th><button onClick={() => setSort('status')}>สถานะ <span>↕</span></button></th><th><button onClick={() => setSort('lastUpdated')}>อัปเดตล่าสุด <span>↕</span></button></th><th /></tr></thead><tbody>{filtered.map((printer) => <tr key={printer.id} className={selected.includes(printer.id) ? 'is-selected' : ''}><td className="check-cell"><input type="checkbox" aria-label={`เลือก ${printer.name}`} checked={selected.includes(printer.id)} onChange={() => toggleSelected(printer.id)} /></td><td><div className="printer-cell"><span className={`printer-glyph ${STATUS_TONE[printer.status]}`}><Icon name="wifi" /></span><div><strong>{printer.name}</strong><small>{printer.ip}</small></div></div></td><td><span className="muted-cell">{printer.location}</span></td><td><span className="type-pill">{printer.type}</span></td><td><span className={`status-label ${STATUS_TONE[printer.status]}`}><i className="status-dot" />{STATUS_LABEL[printer.status] ?? printer.status}</span></td><td><span className="muted-cell">{fmtTime(printer.lastUpdated)}</span></td><td><div className="row-actions"><button aria-label={`แก้ไข ${printer.name}`} onClick={() => openEdit(printer)}><Icon name="edit" /></button><button aria-label={`ลบ ${printer.name}`} onClick={() => deleteIds([printer.id])}><Icon name="trash" /></button></div></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state"><span>⌁</span><strong>ไม่พบเครื่องพิมพ์</strong><p>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p></div>}</div><div className="card-list">{filtered.map((printer) => <article className="printer-card" key={printer.id}><div className="printer-card__top"><div className="printer-cell"><span className={`printer-glyph ${STATUS_TONE[printer.status]}`}><Icon name="wifi" /></span><div><strong>{printer.name}</strong><small>{printer.ip}</small></div></div><input type="checkbox" aria-label={`เลือก ${printer.name}`} checked={selected.includes(printer.id)} onChange={() => toggleSelected(printer.id)} /></div><div className="printer-card__meta"><span>{printer.location}</span><span>{printer.type}</span></div><div className="printer-card__foot"><span className={`status-label ${STATUS_TONE[printer.status]}`}><i className="status-dot" />{STATUS_LABEL[printer.status] ?? printer.status}</span><span>{fmtTime(printer.lastUpdated)}</span><button aria-label={`แก้ไข ${printer.name}`} onClick={() => openEdit(printer)}><Icon name="edit" /></button></div></article>)}</div><div className="panel-foot"><span>แสดง {filtered.length} จาก {printers.length} เครื่อง</span><div className="pagination"><button disabled>‹</button><button className="is-active">1</button><button disabled>›</button></div><span className="footer-hint">อัปเดตอัตโนมัติทุก 5 นาที</span></div></section>
      </main><nav className="mobile-nav"><button className={view === 'manage' ? 'is-active' : ''} onClick={() => setView('manage')}><Icon name="grid" /><span>จัดการ</span></button><button className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}><Icon name="list" /><span>รายการ</span></button><button onClick={openAdd}><Icon name="plus" /><span>เพิ่มใหม่</span></button><button onClick={() => setThemeOpen(true)}><Icon name="settings" /><span>ตั้งค่า</span></button></nav>
    </div><PrinterEditor open={editorOpen} initial={editing} onClose={() => setEditorOpen(false)} onSave={savePrinter} /><ThemeStudio open={themeOpen} onClose={() => setThemeOpen(false)} />{bulkConfirm && <div className="modal-backdrop" role="presentation"><div className="confirm-modal" role="alertdialog" aria-labelledby="bulk-title"><span className="danger-icon"><Icon name="trash" /></span><h2 id="bulk-title">ลบเครื่องพิมพ์ {selected.length} รายการ?</h2><p>การลบนี้ย้อนกลับไม่ได้ แต่ข้อมูลในชีตจะยังคงอยู่จนกว่าจะซิงก์</p><div><button className="ghost-button" onClick={() => setBulkConfirm(false)}>ยกเลิก</button><button className="danger-button" onClick={() => deleteIds(selected)}>ลบรายการ</button></div></div></div>}{notice && <div className="toast" role="status"><Icon name="check" />{notice}</div>}
  </div>;
}
