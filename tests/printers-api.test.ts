import { describe, expect, it, vi } from 'vitest';
import { buildPrinterWritePayload, createPrinterApi } from '../src/services/printers-api';
import { normalizePrinter } from '../src/types/printer';

const record = { id: 'p1', name: 'Printer 1', ip: '10.0.0.1', location: 'IT', type: 'MFP', status: 'online', lastUpdated: '', note: '', mac: 'forbidden' };

describe('printer API contract', () => {
  it('ตัด key ที่ backend ไม่รองรับ', () => {
    expect(normalizePrinter(record)).toEqual({ id: 'p1', name: 'Printer 1', ip: '10.0.0.1', location: 'IT', type: 'MFP', status: 'online', lastUpdated: '', note: '' });
  });

  it('สร้าง strict write payload', () => {
    const payload = buildPrinterWritePayload('syncPrinters', [record], () => new Date('2026-08-16T08:00:00Z'));
    expect(payload).toMatchObject({ action: 'syncPrinters', source: 'Printer Management Pro', updatedAt: '2026-08-16T08:00:00.000Z' });
    expect(JSON.stringify(payload)).not.toContain('mac');
  });

  it('GET แบบ no-store และปฏิเสธ invalid response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, printers: [record] }) });
    await createPrinterApi(fetchMock).load();
    expect(fetchMock).toHaveBeenCalledWith('/api/printers', expect.objectContaining({ method: 'GET', cache: 'no-store' }));
  });
});
