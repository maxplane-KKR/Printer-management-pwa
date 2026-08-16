import { normalizePrinterList } from '../types/printer';
import type { PrinterCache } from './printer-cache';

export async function migrateLegacyPrinterCache(storage: Storage, cache: PrinterCache): Promise<boolean> {
  const raw = storage.getItem('enterprisePrintersDB');
  if (!raw) return false;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return false; }
  const printers = normalizePrinterList(parsed);
  if (!printers.length) return false;
  await cache.save(printers);
  storage.removeItem('enterprisePrintersDB');
  storage.removeItem('enterprisePrintersDataVersion');
  return true;
}
