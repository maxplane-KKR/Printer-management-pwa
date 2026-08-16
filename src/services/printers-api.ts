import { normalizePrinter, normalizePrinterList, type Printer, type PrinterWriteAction } from '../types/printer';

export class PrinterApiError extends Error {
  constructor(readonly code: string, message = code) {
    super(message);
    this.name = 'PrinterApiError';
  }
}

export function buildPrinterWritePayload(action: PrinterWriteAction, printers: unknown[], now: () => Date = () => new Date()) {
  if (action !== 'syncPrinters' && action !== 'saveToSheet') throw new PrinterApiError('INVALID_ACTION');
  return {
    action,
    source: 'Printer Management Pro',
    updatedAt: now().toISOString(),
    printers: normalizePrinterList(printers),
  };
}

export function createPrinterApi(fetchImpl: typeof fetch = fetch, url = '/api/printers') {
  async function readJson(response: Response): Promise<Record<string, unknown> | null> {
    try {
      const value: unknown = await response.json();
      return value && typeof value === 'object' ? value as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }

  return {
    async load(): Promise<{ printers: Printer[]; syncedAt: string }> {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const result = await readJson(response);
      if (!response.ok || result?.ok !== true || !Array.isArray(result.printers)) {
        throw new PrinterApiError(String(result?.code ?? 'INVALID_RESPONSE'));
      }
      return { printers: normalizePrinterList(result.printers), syncedAt: String(result.syncedAt ?? '') };
    },
    async save(action: PrinterWriteAction, printers: unknown[], now: () => Date = () => new Date()) {
      const payload = buildPrinterWritePayload(action, printers, now);
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      const result = await readJson(response);
      if (!response.ok || result?.ok !== true) throw new PrinterApiError(String(result?.code ?? 'SAVE_FAILED'));
      return result;
    },
  };
}

export type PrinterApi = ReturnType<typeof createPrinterApi>;
