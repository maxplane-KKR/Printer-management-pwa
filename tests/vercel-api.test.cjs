const assert = require('node:assert/strict');

const handler = require('../api/printers.js');

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

async function runRequest(req, fetchImpl) {
  const originalFetch = global.fetch;
  global.fetch = fetchImpl || (async () => { throw new Error('fetch must not be called'); });
  const res = createResponse();
  try {
    await handler(req, res);
    return res;
  } finally {
    global.fetch = originalFetch;
  }
}

async function main() {
  const originalEndpoint = process.env.APPS_SCRIPT_URL;
  const originalSecret = process.env.API_SHARED_SECRET;
  const originalConsoleError = console.error;
  const endpoint = 'https://upstream.example.test/exec';
  const secret = 'server-only-test-secret';
  console.error = () => {};

  try {
    delete process.env.APPS_SCRIPT_URL;
    delete process.env.API_SHARED_SECRET;
    let res = await runRequest({ method: 'GET' });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { ok: false, code: 'CONFIG_ERROR' });
    assert.equal(res.headers['Cache-Control'], 'no-store');

    process.env.APPS_SCRIPT_URL = endpoint;
    process.env.API_SHARED_SECRET = secret;

    res = await runRequest({ method: 'DELETE' });
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'GET, POST');
    assert.deepEqual(res.body, { ok: false, code: 'METHOD_NOT_ALLOWED' });

    let fetchCall;
    res = await runRequest({ method: 'GET' }, async (...args) => {
      fetchCall = args;
      return {
        ok: true,
        async json() {
          return { ok: true, printers: [{ id: 'p-1', name: 'Printer 1' }] };
        }
      };
    });
    assert.equal(res.statusCode, 200);
    assert.equal(fetchCall[0], endpoint);
    assert.equal(fetchCall[1].method, 'POST');
    assert.equal(fetchCall[1].headers['Content-Type'], 'text/plain;charset=utf-8');
    assert.equal(fetchCall[1].redirect, 'follow');
    assert.deepEqual(JSON.parse(fetchCall[1].body), { action: 'getPrinters', token: secret });
    let serializedResponse = JSON.stringify(res.body);
    assert.equal(serializedResponse.includes(secret), false, 'response ห้ามมี shared secret');
    assert.equal(serializedResponse.includes(endpoint), false, 'response ห้ามมี Apps Script URL');

    res = await runRequest({ method: 'POST', body: { action: 'syncPrinters' } });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { ok: false, code: 'INVALID_PAYLOAD' });

    res = await runRequest({
      method: 'POST',
      body: { action: 'syncPrinters', printers: [{ note: 'x'.repeat(1000000) }] }
    });
    assert.equal(res.statusCode, 413);
    assert.deepEqual(res.body, { ok: false, code: 'PAYLOAD_TOO_LARGE' });

    res = await runRequest({ method: 'GET' }, async () => ({
      ok: false,
      status: 503,
      async json() { return { ok: false }; }
    }));
    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.body, { ok: false, code: 'UPSTREAM_UNAVAILABLE' });

    res = await runRequest({ method: 'GET' }, async () => ({
      ok: true,
      async json() { throw new SyntaxError('invalid json'); }
    }));
    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.body, { ok: false, code: 'UPSTREAM_UNAVAILABLE' });

    res = await runRequest({ method: 'GET' }, async () => ({
      ok: true,
      async json() { return { ok: false, error: 'backend rejected request' }; }
    }));
    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.body, { ok: false, code: 'UPSTREAM_ERROR' });

    serializedResponse = JSON.stringify(res.body);
    assert.equal(serializedResponse.includes(secret), false, 'error response ห้ามมี shared secret');
    assert.equal(serializedResponse.includes(endpoint), false, 'error response ห้ามมี Apps Script URL');
  } finally {
    console.error = originalConsoleError;
    if (originalEndpoint === undefined) delete process.env.APPS_SCRIPT_URL;
    else process.env.APPS_SCRIPT_URL = originalEndpoint;
    if (originalSecret === undefined) delete process.env.API_SHARED_SECRET;
    else process.env.API_SHARED_SECRET = originalSecret;
  }

  console.log('vercel api contract tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
