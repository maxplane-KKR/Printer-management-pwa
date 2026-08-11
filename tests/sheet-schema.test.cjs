const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
const context = {
  console,
  Date,
  Set,
  PropertiesService: {
    getScriptProperties() { return { getProperty() { return ''; } }; }
  },
  SpreadsheetApp: { getActiveSpreadsheet() { return null; } },
  LockService: {
    getScriptLock() {
      return { waitLock() {}, releaseLock() {} };
    }
  },
  ContentService: { MimeType: { JSON: 'json' } }
};
vm.createContext(context);
vm.runInContext(source + '\n;globalThis.__headers = HEADERS;', context);

assert.deepEqual(Array.from(context.__headers), [
  'ID', 'Printer Name', 'IP Address', 'Location', 'Type',
  'Status', 'Last Updated', 'Note', 'Synced At'
]);
assert.equal(typeof context.getPrintersFromSheet, 'function', 'ต้องมี read API จากชีต');

const normalized = context.normalizePrinters_([{
  id: 'p-1', name: 'Printer 1', ip: '192.168.1.10', mac: 'AA:BB:CC:DD:EE:FF',
  location: 'IT', type: 'Laser', status: 'online', lastUpdated: '11/08/2026 10:00', note: 'ready'
}]);
assert.equal(Object.prototype.hasOwnProperty.call(normalized[0], 'mac'), false, 'schema ใหม่ต้องไม่คืน mac');

const legacyRows = [
  ['ID', 'Printer Name', 'IP Address', 'MAC Address', 'Location', 'Type', 'Status', 'Last Updated', 'Note', 'Synced At'],
  ['p-2', 'Legacy Printer', '192.168.1.20', 'AA:BB:CC:DD:EE:FF', 'HR', 'MFP', 'offline', '11/08/2026 09:00', 'legacy', '2026-08-11T02:00:00.000Z']
];
const legacyMapped = context.mapSheetRowsByHeader_(legacyRows);
assert.equal(legacyMapped[0].name, 'Legacy Printer');
assert.equal(legacyMapped[0].location, 'HR');
assert.equal(Object.prototype.hasOwnProperty.call(legacyMapped[0], 'mac'), false, 'อ่าน legacy sheet แล้วต้องทิ้ง MAC');
assert.match(source, /Printers_MAC_Backup_/, 'migration ต้องสำรองชีตก่อนลบ MAC');
assert.match(source, /deleteColumn\(/, 'migration ต้องลบคอลัมน์ MAC จริง');

console.log('sheet schema contract tests passed');
