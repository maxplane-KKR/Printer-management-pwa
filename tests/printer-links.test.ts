import { describe, expect, it } from 'vitest';
import { getPrinterWebUrl } from '../src/features/printers/printer-links';

describe('printer web links', () => {
  it('builds safe http URLs for IPv4 addresses', () => {
    expect(getPrinterWebUrl('10.20.4.18')).toBe('http://10.20.4.18');
    expect(getPrinterWebUrl(' 10.20.4.18 ')).toBe('http://10.20.4.18');
  });

  it('rejects invalid or unsafe addresses', () => {
    expect(getPrinterWebUrl('printer.local')).toBe('');
    expect(getPrinterWebUrl('999.1.1.1')).toBe('');
    expect(getPrinterWebUrl('javascript:alert(1)')).toBe('');
  });
});
