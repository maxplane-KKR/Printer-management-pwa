import type { Printer } from '../../types/printer';

export const CSV_HEADERS = ['Name', 'IP', 'Location', 'Type', 'Status', 'LastUpdated', 'Note'] as const;
const fields: (keyof Printer)[] = ['name', 'ip', 'location', 'type', 'status', 'lastUpdated', 'note'];
const csvCell = (value: string) => `"${String(value).replaceAll('"', '""')}"`;

export function serializePrintersCsv(printers: Printer[]): string {
  return `\uFEFF${CSV_HEADERS.join(',')}\n${printers.map((printer) => fields.map((field) => csvCell(printer[field])).join(',')).join('\n')}`;
}

export function getExportFilename(now = new Date()): string {
  return `printer-fleet-${now.toISOString().slice(0, 10)}.csv`;
}
