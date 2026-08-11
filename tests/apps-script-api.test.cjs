const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');

function createHarness(configuredSecret = 'test-secret') {
  const properties = new Map([['API_SHARED_SECRET', configuredSecret]]);
  const errors = [];
  const sandbox = {
    Date,
    JSON,
    Set,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => properties.get(key) || ''
      })
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: text => ({
        text,
        mimeType: '',
        setMimeType(mimeType) {
          this.mimeType = mimeType;
          return this;
        }
      })
    },
    console: {
      error(value) { errors.push(String(value)); }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  let readCalls = 0;
  let writeCalls = 0;
  let lastWritePayload;
  sandbox.getPrintersFromSheet = () => {
    readCalls += 1;
    return { ok: true, printers: [{ id: 'p-1' }], syncedAt: '2026-08-11T08:00:00.000Z', schemaVersion: 2 };
  };
  sandbox.savePrintersToSheet = payload => {
    writeCalls += 1;
    lastWritePayload = payload;
    return { ok: true, action: payload.action, syncedRows: payload.printers.length, syncedAt: '2026-08-11T08:00:00.000Z' };
  };

  return {
    call(payload) {
      const output = sandbox.doPost({ postData: { contents: JSON.stringify(payload) } });
      return JSON.parse(output.text);
    },
    errors,
    properties,
    get readCalls() { return readCalls; },
    get writeCalls() { return writeCalls; },
    get lastWritePayload() { return lastWritePayload; }
  };
}

{
  const harness = createHarness();
  const response = harness.call({ action: 'getPrinters', token: 'wrong-secret' });

  assert.equal(response.ok, false, 'token ผิดต้องถูกปฏิเสธ');
  assert.equal(harness.readCalls, 0, 'token ผิดต้องไม่อ่านชีต');
  assert.equal(harness.writeCalls, 0, 'token ผิดต้องไม่เขียนชีต');
}

{
  const harness = createHarness();
  const response = harness.call({ action: 'getPrinters', token: 'test-secret' });

  assert.equal(response.ok, true, 'token ถูกต้องต้องอ่านข้อมูลได้');
  assert.equal(response.printers[0].id, 'p-1');
  assert.equal(harness.readCalls, 1, 'getPrinters ต้องอ่านชีตหนึ่งครั้ง');
  assert.equal(harness.writeCalls, 0, 'getPrinters ต้องไม่เขียนชีต');
}

{
  const harness = createHarness('');
  const response = harness.call({ action: 'getPrinters', token: 'test-secret' });

  assert.equal(response.ok, false, 'ไม่มี API_SHARED_SECRET ต้อง fail closed');
  assert.equal(harness.readCalls, 0, 'ยังไม่ตั้ง secret ต้องไม่อ่านชีต');
  assert.equal(harness.writeCalls, 0, 'ยังไม่ตั้ง secret ต้องไม่เขียนชีต');
}

{
  const harness = createHarness();
  const printers = [{ id: 'p-1', name: 'Printer 1', ip: '192.168.1.10' }];
  const response = harness.call({
    action: 'syncPrinters',
    token: 'test-secret',
    printers,
    updatedAt: '2026-08-11T08:00:00.000Z'
  });

  assert.equal(response.ok, true, 'syncPrinters พร้อม token ถูกต้องต้องบันทึกได้');
  assert.equal(response.syncedRows, 1);
  assert.equal(harness.readCalls, 0, 'syncPrinters ต้องไม่อ่านชีต');
  assert.equal(harness.writeCalls, 1, 'syncPrinters ต้องเขียนชีตหนึ่งครั้ง');
  assert.equal(harness.lastWritePayload.printers[0].id, 'p-1');
}

{
  const harness = createHarness('different-secret');
  const response = harness.call({ action: 'getPrinters', token: 'test-secret' });
  const observableError = JSON.stringify(response) + '\n' + harness.errors.join('\n');

  assert.equal(response.ok, false);
  assert.doesNotMatch(observableError, /test-secret/, 'response และ log ห้ามเปิดเผย token');
}

console.log('apps script API contract tests passed');
