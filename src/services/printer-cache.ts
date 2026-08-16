import { normalizePrinterList, type Printer } from '../types/printer';

export interface PrinterCache {
  load(): Promise<Printer[]>;
  save(printers: Printer[]): Promise<void>;
}

function openDatabase(factory: IDBFactory, databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

function readSnapshot(database: IDBDatabase): Promise<Printer[]> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('snapshots', 'readonly');
    const request = transaction.objectStore('snapshots').get('printers:v2');
    request.onsuccess = () => resolve(normalizePrinterList(request.result));
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('IndexedDB read aborted')); };
  });
}

function writeSnapshot(database: IDBDatabase, printers: Printer[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('snapshots', 'readwrite');
    transaction.objectStore('snapshots').put(normalizePrinterList(printers), 'printers:v2');
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('IndexedDB write failed')); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('IndexedDB write aborted')); };
  });
}

export function createPrinterCache(factory: IDBFactory = indexedDB, databaseName = 'printer-management-pwa'): PrinterCache {
  return {
    async load() { return readSnapshot(await openDatabase(factory, databaseName)); },
    async save(printers) { await writeSnapshot(await openDatabase(factory, databaseName), printers); },
  };
}
