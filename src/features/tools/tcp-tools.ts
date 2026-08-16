import { normalizePrinter, type Printer } from '../../types/printer';

export interface TcpResult { ip: string; status: string }

export function buildTcpScanScript(ips: string[]): string {
  const targets = ips.filter((ip) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip));
  const literal = `@(${targets.map((ip) => `'${ip.replaceAll("'", "''")}'`).join(', ')})`;
  return `$ips = ${literal}\n$ports = @(9100, 80)\n$results = foreach ($ip in $ips) { $online = $false; foreach ($port in $ports) { try { $client = [System.Net.Sockets.TcpClient]::new(); $task = $client.ConnectAsync($ip, $port); if ($task.Wait(1000) -and $client.Connected) { $online = $true }; $client.Dispose() } catch {} }; [pscustomobject]@{ ip = $ip; status = if ($online) { 'online' } else { 'offline' } } }\n$results | ConvertTo-Json -Compress | Set-Clipboard`;
}

export function parseTcpResults(raw: string): TcpResult[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('รูปแบบ JSON ไม่ถูกต้อง'); }
  const values = Array.isArray(parsed) ? parsed : [];
  if (!Array.isArray(parsed)) throw new Error('ต้องเป็น JSON array');
  const results = values.filter((item): item is Record<string, unknown> => item && typeof item === 'object' && typeof (item as Record<string, unknown>).ip === 'string' && typeof (item as Record<string, unknown>).status === 'string').map((item) => ({ ip: String(item.ip), status: String(item.status) }));
  if (!results.length) throw new Error('ไม่พบข้อมูล ip/status');
  return results;
}

export function applyTcpResults(printers: Printer[], results: TcpResult[], now = new Date()): { printers: Printer[]; updatedCount: number } {
  const map = new Map(results.map((item) => [item.ip.trim(), item.status.trim()]));
  let updatedCount = 0;
  const updated = printers.map((printer) => {
    const status = map.get(printer.ip);
    if (!status) return printer;
    updatedCount += 1;
    return normalizePrinter({ ...printer, status, lastUpdated: now.toISOString() });
  });
  return { printers: updated, updatedCount };
}
