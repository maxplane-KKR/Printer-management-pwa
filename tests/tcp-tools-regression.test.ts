import { describe, expect, it } from 'vitest';
import { buildTcpScanScript, parseTcpResults } from '../src/features/tools/tcp-tools';

describe('TCP status workflow regression', () => {
  it('generates a bounded, observable scan and always copies a JSON array', () => {
    const script = buildTcpScanScript(['10.0.0.1']);

    expect(script).toContain('$timeoutMs = 500');
    expect(script).toContain('$task.Wait($timeoutMs)');
    expect(script).toContain('Write-Progress');
    expect(script).toContain('break');
    expect(script).toContain('ConvertTo-Json -InputObject @($results) -Compress');
    expect(script).toContain('Set-Clipboard -Value $payload');
  });

  it('accepts a single JSON object copied from PowerShell', () => {
    expect(parseTcpResults('{"ip":"10.0.0.1","status":"online"}')).toEqual([
      { ip: '10.0.0.1', status: 'online' },
    ]);
  });
});
