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
  if (req.method === 'POST' && !Array.isArray(clientPayload?.printers)) {
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
