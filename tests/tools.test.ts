import { describe, expect, it } from 'vitest';
import { serializePrintersCsv } from '../src/features/tools/csv-tools';
import { applyTcpResults, buildTcpScanScript, parseTcpResults } from '../src/features/tools/tcp-tools';
import { normalizePrinter } from '../src/types/printer';

const printer = normalizePrinter({ id: 'p1', name: 'Printer 1', ip: '10.0.0.1', location: 'IT', type: 'MFP', status: 'offline' });

describe('fleet tools', () => {
  it('CSV มี BOM/header และ escape quote', () => {
    const csv = serializePrintersCsv([{ ...printer, note: 'หมึก "ใกล้หมด"' }]);
    expect(csv.startsWith('\uFEFFName,IP,Location,Type,Status,LastUpdated,Note\n')).toBe(true);
    expect(csv).toContain('"หมึก ""ใกล้หมด"""');
  });

  it('TCP script ตรวจ port 9100 และ 80 เท่านั้น', () => {
    const script = buildTcpScanScript(['10.0.0.1', 'hostname']);
    expect(script).toContain('$ports = @(9100, 80)');
    expect(script).toContain('Set-Clipboard');
    expect(script).toContain('10.0.0.1');
    expect(script).not.toContain('hostname');
  });

  it('import/apply รับเฉพาะ array ที่มี ip/status string', () => {
    expect(parseTcpResults('[{"ip":"10.0.0.1","status":"online"}]')).toEqual([{ ip: '10.0.0.1', status: 'online' }]);
    expect(() => parseTcpResults('{"ip":"10.0.0.1"}')).toThrow();
    const result = applyTcpResults([printer], [{ ip: '10.0.0.1', status: 'online' }], new Date('2026-08-16T08:00:00Z'));
    expect(result.updatedCount).toBe(1);
    expect(result.printers[0]?.status).toBe('online');
  });
});
