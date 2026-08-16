export const PRINTER_KEYS = ['id', 'name', 'ip', 'location', 'type', 'status', 'lastUpdated', 'note'] as const;

export type Printer = Record<(typeof PRINTER_KEYS)[number], string>;
export type PrinterWriteAction = 'syncPrinters' | 'saveToSheet';
export type PrinterDraft = Omit<Printer, 'id' | 'lastUpdated'> & { id?: string; lastUpdated?: string };

export const EMPTY_PRINTER: PrinterDraft = {
  name: '', ip: '', location: '', type: '', status: 'offline', lastUpdated: '', note: '', id: '',
};

export function normalizePrinter(value: unknown): Printer {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(PRINTER_KEYS.map((key) => [
    key,
    source[key] == null ? '' : String(source[key]).trim(),
  ])) as Printer;
}

export function normalizePrinterList(value: unknown): Printer[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizePrinter).filter((printer) => printer.id && printer.name && printer.ip);
}

export function validatePrinterDraft(draft: PrinterDraft): Record<'name' | 'ip' | 'location' | 'type', string> {
  return {
    name: draft.name.trim() ? '' : 'กรอกชื่อเครื่องพิมพ์',
    ip: draft.ip.trim() ? '' : 'กรอก IP Address',
    location: draft.location.trim() ? '' : 'กรอกสถานที่',
    type: draft.type.trim() ? '' : 'กรอกรุ่นหรือประเภท',
  };
}

export function createPrinterId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `printer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
