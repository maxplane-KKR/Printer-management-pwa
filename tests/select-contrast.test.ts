import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stylesheet = readFileSync(join(root, 'src', 'styles', 'fleet.css'), 'utf8');

describe('select contrast', () => {
  it('sets explicit readable colors for native option menus in dark mode', () => {
    const optionRule = stylesheet.match(/\.filter-bar select option,\s*\.editor-form select option\s*\{[^}]+\}/)?.[0] ?? '';

    expect(optionRule).toContain('color: var(--text)');
    expect(optionRule).toContain('background-color: var(--panel-solid)');
  });
});
