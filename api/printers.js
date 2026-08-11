const WRITE_ACTIONS = new Set(['syncPrinters', 'saveToSheet']);
const PAYLOAD_KEYS = new Set(['action', 'source', 'updatedAt', 'printers']);
const PRINTER_KEYS = new Set(['id', 'name', 'ip', 'location', 'type', 'status', 'lastUpdated', 'note']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidWritePayload(payload) {
  if (!isPlainObject(payload) || !WRITE_ACTIONS.has(payload.action) || !Array.isArray(payload.printers)) return false;
  if (payload.printers.length > 5000 || Object.keys(payload).some(key => !PAYLOAD_KEYS.has(key))) return false;
  if (payload.source !== undefined && typeof payload.source !== 'string') return false;
  if (payload.updatedAt !== undefined && typeof payload.updatedAt !== 'string') return false;

  return payload.printers.every(printer =>
    isPlainObject(printer) &&
    Object.keys(printer).every(key => PRINTER_KEYS.has(key)) &&
    Object.values(printer).every(value => typeof value === 'string')
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
  }

  const endpoint = process.env.APPS_SCRIPT_URL;
  const token = process.env.API_SHARED_SECRET;
  if (!endpoint || !token) {
    return res.status(500).json({ ok: false, code: 'CONFIG_ERROR' });
  }

  const clientPayload = req.method === 'GET' ? { action: 'getPrinters' } : req.body;
  if (req.method === 'POST' && !isValidWritePayload(clientPayload)) {
    return res.status(400).json({ ok: false, code: 'INVALID_PAYLOAD' });
  }

  const upstreamPayload = { ...clientPayload, token };
  const serialized = JSON.stringify(upstreamPayload);
  if (Buffer.byteLength(serialized) > 1000000) {
    return res.status(413).json({ ok: false, code: 'PAYLOAD_TOO_LARGE' });
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: serialized,
      redirect: 'follow'
    });
    if (!upstream.ok) throw new Error('Upstream status ' + upstream.status);

    const result = await upstream.json();
    return res.status(result?.ok ? 200 : 502).json(
      result?.ok ? result : { ok: false, code: 'UPSTREAM_ERROR' }
    );
  } catch (error) {
    console.error('Apps Script proxy failed.', error?.message || error);
    return res.status(502).json({ ok: false, code: 'UPSTREAM_UNAVAILABLE' });
  }
};
