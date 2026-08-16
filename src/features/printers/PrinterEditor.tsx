import { useEffect, useState } from 'react';
import { createPrinterId, EMPTY_PRINTER, validatePrinterDraft, type Printer, type PrinterDraft } from '../../types/printer';

interface PrinterEditorProps {
  open: boolean;
  initial?: Printer | null;
  onClose: () => void;
  onSave: (printer: Printer) => void;
}

export function PrinterEditor({ open, initial, onClose, onSave }: PrinterEditorProps) {
  const [draft, setDraft] = useState<PrinterDraft>(initial ?? EMPTY_PRINTER);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => { if (open) { setDraft(initial ?? EMPTY_PRINTER); setErrors({}); setConfirmClose(false); } }, [initial, open]);
  if (!open) return null;
  const isEdit = Boolean(initial);
  const isDirty = Boolean(draft.name || draft.ip || draft.location || draft.type || draft.note) && !initial;
  const update = (key: keyof PrinterDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = () => {
    const nextErrors = validatePrinterDraft(draft);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    onSave({ id: draft.id || createPrinterId(), name: draft.name.trim(), ip: draft.ip.trim(), location: draft.location.trim(), type: draft.type.trim(), status: draft.status || 'offline', lastUpdated: draft.lastUpdated || new Date().toISOString(), note: draft.note.trim() });
  };
  const requestClose = () => { if (isDirty) setConfirmClose(true); else onClose(); };
  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <aside className="editor-drawer" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <div className="drawer-head"><div><span className="eyebrow">{isEdit ? 'UPDATE NODE' : 'REGISTER NODE'}</span><h2 id="editor-title">{isEdit ? 'แก้ไขเครื่องพิมพ์' : 'เพิ่มเครื่องพิมพ์'}</h2><p>{isEdit ? 'อัปเดตข้อมูลให้ทีมเห็นตรงกัน' : 'เพิ่ม endpoint ใหม่เข้าสู่ fleet'}</p></div><button className="icon-button" aria-label="ปิด" onClick={requestClose}>×</button></div>
      <div className="editor-form">
        <label>ชื่อเครื่องพิมพ์<input aria-label="ชื่อเครื่องพิมพ์" value={draft.name} onChange={(event) => update('name', event.target.value)} placeholder="เช่น Finance - ชั้น 2" />{errors.name && <small className="field-error">{errors.name}</small>}</label>
        <label>IP Address<input aria-label="IP Address" value={draft.ip} onChange={(event) => update('ip', event.target.value)} placeholder="10.20.4.18" />{errors.ip && <small className="field-error">{errors.ip}</small>}</label>
        <div className="form-grid"><label>สถานที่<input aria-label="สถานที่" value={draft.location} onChange={(event) => update('location', event.target.value)} placeholder="สำนักงานใหญ่ / ชั้น 2" />{errors.location && <small className="field-error">{errors.location}</small>}</label><label>รุ่น / ประเภท<input aria-label="รุ่นหรือประเภท" value={draft.type} onChange={(event) => update('type', event.target.value)} placeholder="Xerox C7030" />{errors.type && <small className="field-error">{errors.type}</small>}</label></div>
        <label>สถานะ<select aria-label="สถานะ" value={draft.status} onChange={(event) => update('status', event.target.value)}><option value="online">Online</option><option value="offline">Offline</option><option value="warning">Warning</option><option value="maintenance">Maintenance</option></select></label>
        <label>หมายเหตุ<textarea aria-label="หมายเหตุ" rows={4} value={draft.note} onChange={(event) => update('note', event.target.value)} placeholder="ใส่ข้อมูลที่ทีมควรรู้" /></label>
      </div>
      <div className="drawer-foot"><button className="ghost-button" onClick={requestClose}>ยกเลิก</button><button className="primary-button" onClick={submit}>{isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มเครื่องพิมพ์'}</button></div>
      {confirmClose && <div className="confirm-card" role="alertdialog" aria-labelledby="discard-title"><strong id="discard-title">ทิ้งการเปลี่ยนแปลง?</strong><p>ข้อมูลที่กรอกไว้จะหายไป</p><div><button className="ghost-button" onClick={() => setConfirmClose(false)}>อยู่ต่อ</button><button className="danger-button" onClick={onClose}>ทิ้งข้อมูล</button></div></div>}
    </aside>
  </div>;
}
