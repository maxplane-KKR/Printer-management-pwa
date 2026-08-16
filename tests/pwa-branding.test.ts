import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8'),
) as Record<string, unknown>;
const html = readFileSync(join(root, 'index.html'), 'utf8');
const serviceWorker = readFileSync(join(root, 'public', 'service-worker.js'), 'utf8');

describe('PrintPro PWA branding', () => {
  it('uses a short cross-platform name and install metadata', () => {
    expect(manifest).toMatchObject({
      id: '/printpro',
      name: 'PrintPro — Printer Fleet',
      short_name: 'PrintPro',
      display: 'standalone',
      orientation: 'any',
      prefer_related_applications: false,
      theme_color: '#E50914',
      background_color: '#07090D',
    });
    expect(manifest.display_override).toEqual([
      'window-controls-overlay',
      'standalone',
      'minimal-ui',
      'browser',
    ]);
  });

  it('declares iOS and Windows metadata', () => {
    expect(html).toContain('apple-mobile-web-app-title');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('msapplication-TileImage');
    expect(html).toContain('mask-icon');
    expect(html).toContain('<title>PrintPro · Printer Fleet</title>');
  });

  it('pre-caches the cross-platform icon set', () => {
    for (const icon of [
      'icon-any-192-v3.png',
      'icon-any-512-v3.png',
      'icon-maskable-192-v2.png',
      'icon-maskable-512-v2.png',
      'apple-touch-icon.png',
      'favicon.ico',
      'mstile-150x150.png',
    ]) {
      expect(serviceWorker).toContain(icon);
    }
    expect(serviceWorker).toContain('printer-management-shell-v4');
  });
});
