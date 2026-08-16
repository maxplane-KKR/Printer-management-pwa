# Printer Fleet Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** รื้อ frontend เดิมเป็น React + TypeScript + Vite ที่ใช้งานง่ายบน desktop/mobile คง backend contract เดิม และรองรับ Theme Studio 6 presets โดยเริ่มต้นที่ Netflix Dark Glass

**Architecture:** Vercel เป็น frontend host และ proxy `/api/printers` ไป Apps Script เดิม Frontend แบ่งเป็น feature modules สำหรับ printer data, sync, tools และ theme โดยใช้ typed API adapter, React reducer/context และ native IndexedDB cache Compact layout ไม่เกิน 1024px ใช้ 2 แท็บ ส่วน desktop ใช้ table-centric command center

**Tech Stack:** React, TypeScript, Vite, CSS custom properties, Vitest, React Testing Library, Playwright, vite-plugin-pwa, native IndexedDB, pnpm

## Global Constraints

- Node.js ต้องคง `24.x` และใช้ pnpm พร้อม commit `pnpm-lock.yaml`
- Production frontend deploy ผ่าน Vercel; Apps Script เป็น upstream data service เท่านั้น
- ห้ามแก้ `api/printers.js`, `Code.gs`, Google Sheet schema, secret หรือ environment variable เว้นแต่ test พิสูจน์ว่าจำเป็นและผู้ใช้อนุมัติเพิ่ม
- Client เรียกเฉพาะ `/api/printers`; ห้ามฝัง Apps Script URL หรือ shared secret
- Printer payload มีเฉพาะ `id`, `name`, `ip`, `location`, `type`, `status`, `lastUpdated`, `note` และทุกค่าเป็น string
- ห้ามนำ MAC Address กลับมา
- ค่า theme เริ่มต้นคือ Netflix + Dark Glass + opacity 88% + blur 12px
- Presets ต้องมี Mint, Neon, Rose, Sunset, Netflix และ Luxury
- Opacity clamp `40–100`; blur clamp `0–30px`
- Custom image ใช้เฉพาะ Theme Studio preview และ FleetOverview hero card อยู่แค่ session และห้ามใช้เป็น body background
- Viewport `≤1024px` ใช้ compact shell 2 แท็บ `จัดการ`/`รายการ`; `≥1025px` ใช้ desktop shell
- ทุก visible control สูงอย่างน้อย 44px, ไม่มี horizontal overflow, รองรับ safe-area, focus-visible และ reduced motion
- API/PWA/e2e tests ใช้ mock เท่านั้น ห้ามเขียน Google Sheet จริง
- ไม่เพิ่ม component library หรือ state library; เพิ่ม dependency เฉพาะที่ระบุในแผน

---

## แผนผังไฟล์และความรับผิดชอบ

| พื้นที่ | ไฟล์หลัก | ความรับผิดชอบ |
| --- | --- | --- |
| Build shell | `index.html`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js` | Vite entry, build, type-check, lint |
| App shell | `src/app/App.tsx`, `src/app/AppShell.tsx` | Layout, route-free responsive shell, global dialogs |
| App state | `src/app/app-reducer.ts`, `src/app/AppProvider.tsx` | Printer/filter/selection/editor/sync state |
| Domain/API | `src/types/printer.ts`, `src/services/printers-api.ts` | Normalization, payload allowlist, GET/POST contract |
| Offline cache | `src/services/printer-cache.ts`, `src/services/legacy-cache-migration.ts` | IndexedDB snapshot และ migration localStorage เดิม |
| Fleet UI | `src/features/fleet/PrintRail.tsx`, `FleetOverview.tsx` | Health summary และ sync status |
| Browse | `src/features/printers/PrinterTable.tsx`, `PrinterCardList.tsx`, `PrinterFilters.tsx` | Search/filter/sort/pagination/selection |
| Edit | `src/features/printers/PrinterEditor.tsx`, `DeletePrinterDialog.tsx` | Add/edit/delete, validation, dirty guard |
| Tools | `src/features/tools/tcp-tools.ts`, `csv-tools.ts`, `DatabaseTools.tsx` | CSV, TCP script/import, manual sheet sync |
| Theme | `src/features/theme/theme-config.ts`, `ThemeProvider.tsx`, `ThemeStudio.tsx` | 6 presets, Dark/Light, persistence, custom image |
| Styles | `src/styles/tokens.css`, `themes.css`, `globals.css`, `responsive.css` | Design tokens, layouts, focus/motion |
| PWA | `vite.config.ts`, `public/assets/`, `src/pwa/UpdatePrompt.tsx` | Generated manifest/service worker, app shell cache, update prompt |
| Verification | `tests/**/*.test.*`, `e2e/**/*.spec.ts` | Unit, component, contract, responsive/e2e |

---

### Task 1: สร้าง Vite/React shell และ toolchain

**Files:**
- Delete: `Index.html`
- Create: `index.html`
- Modify: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Create: `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`
- Create: `src/main.tsx`, `src/app/App.tsx`, `src/styles/globals.css`
- Create: `tests/setup.ts`, `tests/app-shell.test.tsx`

**Interfaces:**
- Consumes: root DOM element `#root`
- Produces: `App(): JSX.Element`, Vite build scripts และ Vitest environment ที่ task ต่อไปใช้

- [ ] **Step 1: ติดตั้ง dependency และกำหนด pnpm เป็น package manager**

Run:

```powershell
pnpm add react react-dom @fontsource/chakra-petch @fontsource/ibm-plex-sans-thai
pnpm add -D vite typescript @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh @types/react @types/react-dom
```

แก้ scripts ใน `package.json` เป็น:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "typecheck": "tsc -b --pretty false",
    "lint": "eslint .",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 2: สร้าง config ที่ strict และ test environment**

`vite.config.ts` ขั้นต้น:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
});
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.ts'], restoreMocks: true },
});
```

`tsconfig.app.json` ต้องกำหนด strict compiler options:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true
  },
  "include": ["src", "tests", "e2e"]
}
```

`eslint.config.js` ต้องใช้ flat config:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'public/assets'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh }, rules: { ...reactHooks.configs.recommended.rules, 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } },
);
```

`tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: เขียน failing shell test**

`tests/app-shell.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/App';

describe('App shell', () => {
  it('ประกาศชื่อผลิตภัณฑ์และ main landmark', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toHaveTextContent('Printer Fleet Command Center');
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: รัน test ให้เห็นว่า fail**

Run: `pnpm exec vitest run tests/app-shell.test.tsx`

Expected: FAIL เพราะ `src/app/App.tsx` ยังไม่มี

- [ ] **Step 5: แทน monolith ด้วย shell ขั้นต่ำ**

`src/app/App.tsx`:

```tsx
export function App() {
  return (
    <div className="app-shell">
      <header className="app-header">Printer Fleet Command Center</header>
      <main id="main-content" tabIndex={-1}>กำลังเตรียมข้อมูลเครื่องพิมพ์…</main>
    </div>
  );
}
```

`src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import './styles/globals.css';
import { App } from './app/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
```

`index.html`:

```html
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#E50914">
    <title>Printer Management Pro</title>
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

- [ ] **Step 6: ตรวจ shell**

Run:

```powershell
pnpm exec vitest run tests/app-shell.test.tsx
pnpm run typecheck
pnpm run build
```

Expected: PASS ทั้ง 3 คำสั่งและมี `dist/index.html`

- [ ] **Step 7: Commit**

```powershell
git add package.json pnpm-lock.yaml index.html tsconfig*.json vite.config.ts vitest.config.ts eslint.config.js src tests/setup.ts tests/app-shell.test.tsx Index.html
git commit -m "build: scaffold typed React frontend"
```

---

### Task 2: สร้าง Printer domain และ API adapter แบบ strict

**Files:**
- Create: `src/types/printer.ts`
- Create: `src/services/printers-api.ts`
- Create: `tests/printers-api.test.ts`
- Modify: `tests/frontend-api.test.cjs`

**Interfaces:**
- Produces: `Printer`, `normalizePrinter(value)`, `normalizePrinterList(value)`, `buildPrinterWritePayload(action, printers, now)`, `createPrinterApi(fetchImpl, url)`
- Consumes: `/api/printers` contract เดิม

- [ ] **Step 1: เขียน failing domain/API tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildPrinterWritePayload, createPrinterApi, normalizePrinter } from '../src/services/printers-api';

const record = { id: 'p1', name: 'Printer 1', ip: '10.0.0.1', location: 'IT', type: 'MFP', status: 'online', lastUpdated: '', note: '', mac: 'forbidden' };

it('ตัด key ที่ backend ไม่รองรับ', () => {
  expect(normalizePrinter(record)).toEqual({ id: 'p1', name: 'Printer 1', ip: '10.0.0.1', location: 'IT', type: 'MFP', status: 'online', lastUpdated: '', note: '' });
});

it('สร้าง strict write payload', () => {
  expect(buildPrinterWritePayload('syncPrinters', [record], () => new Date('2026-08-16T08:00:00Z'))).toMatchObject({
    action: 'syncPrinters', source: 'Printer Management Pro', updatedAt: '2026-08-16T08:00:00.000Z',
  });
});

it('GET แบบ no-store และปฏิเสธ invalid response', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, printers: [record] }) });
  await createPrinterApi(fetchMock).load();
  expect(fetchMock).toHaveBeenCalledWith('/api/printers', expect.objectContaining({ method: 'GET', cache: 'no-store' }));
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm exec vitest run tests/printers-api.test.ts`

Expected: FAIL เพราะ module ยังไม่มี

- [ ] **Step 3: สร้าง type และ normalizer**

```ts
export const PRINTER_KEYS = ['id', 'name', 'ip', 'location', 'type', 'status', 'lastUpdated', 'note'] as const;
export type Printer = Record<(typeof PRINTER_KEYS)[number], string>;
export type PrinterWriteAction = 'syncPrinters' | 'saveToSheet';

export function normalizePrinter(value: unknown): Printer {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(PRINTER_KEYS.map(key => [key, source[key] == null ? '' : String(source[key]).trim()])) as Printer;
}

export function normalizePrinterList(value: unknown): Printer[] {
  return Array.isArray(value)
    ? value.map(normalizePrinter).filter(item => item.id && item.name && item.ip)
    : [];
}
```
export function buildPrinterWritePayload(action: PrinterWriteAction, printers: unknown[], now: () => Date) {
  if (action !== 'syncPrinters' && action !== 'saveToSheet') throw new PrinterApiError('INVALID_ACTION');
  return {
    action,
    source: 'Printer Management Pro',
    updatedAt: now().toISOString(),
    printers: normalizePrinterList(printers),
  };
}


- [ ] **Step 4: สร้าง API adapter และ error mapping**

```ts
export class PrinterApiError extends Error {
  constructor(readonly code: string) { super(code); }
}

export function createPrinterApi(fetchImpl: typeof fetch, url = '/api/printers') {
  return {
    async load() {
      const response = await fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true || !Array.isArray(result.printers)) throw new PrinterApiError(result?.code || 'INVALID_RESPONSE');
      return { printers: normalizePrinterList(result.printers), syncedAt: String(result.syncedAt || '') };
    },
    async save(payload: ReturnType<typeof buildPrinterWritePayload>) {
      const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) throw new PrinterApiError(result?.code || 'SAVE_FAILED');
      return result;
    },
export type PrinterApi = ReturnType<typeof createPrinterApi>;
  };
}
```


- [ ] **Step 5: Port frontend API contract test**

เปลี่ยน `tests/frontend-api.test.cjs` ให้ตรวจ source ใหม่:

```js
const apiSource = fs.readFileSync(path.join(root, 'src', 'services', 'printers-api.ts'), 'utf8');
assert.match(apiSource, /url = '\/api\/printers'/);
assert.match(apiSource, /cache: 'no-store'/);
assert.doesNotMatch(apiSource, /script\.google\.com|API_SHARED_SECRET/);
```

- [ ] **Step 6: Verify และ commit**

Run:

```powershell
pnpm exec vitest run tests/printers-api.test.ts
node tests/frontend-api.test.cjs
node tests/vercel-api.test.cjs
```

Expected: PASS ทั้งหมด

```powershell
git add src/types src/services/printers-api.ts tests/printers-api.test.ts tests/frontend-api.test.cjs
git commit -m "feat: add strict printer API adapter"
```

---

### Task 3: เพิ่ม IndexedDB snapshot และ legacy cache migration

**Files:**
- Create: `src/services/printer-cache.ts`
- Create: `src/services/legacy-cache-migration.ts`
- Create: `tests/printer-cache.test.ts`
- Modify: `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: `PrinterCache { load(): Promise<Printer[]>; save(printers): Promise<void> }`, `createPrinterCache(indexedDB)`, `migrateLegacyPrinterCache(storage, cache)`
- Consumes: legacy keys `enterprisePrintersDB`, `enterprisePrintersDataVersion`

- [ ] **Step 1: เพิ่ม test-only IndexedDB implementation**

Run: `pnpm add -D fake-indexeddb`

- [ ] **Step 2: เขียน failing cache/migration tests**

```ts
import { indexedDB } from 'fake-indexeddb';
import { createPrinterCache } from '../src/services/printer-cache';
import { migrateLegacyPrinterCache } from '../src/services/legacy-cache-migration';

it('บันทึกและอ่าน normalized snapshot', async () => {
  const cache = createPrinterCache(indexedDB, 'printer-cache-test');
  await cache.save([{ id: 'p1', name: 'P1', ip: '10.0.0.1', location: '', type: '', status: '', lastUpdated: '', note: '' }]);
  await expect(cache.load()).resolves.toHaveLength(1);
});

it('ไม่ลบ legacy key จน IndexedDB save สำเร็จ', async () => {
  localStorage.setItem('enterprisePrintersDB', JSON.stringify([{ id: 'p1', name: 'P1', ip: '10.0.0.1' }]));
  const cache = { load: vi.fn().mockResolvedValue([]), save: vi.fn().mockRejectedValue(new Error('quota')) };
  await expect(migrateLegacyPrinterCache(localStorage, cache)).rejects.toThrow('quota');
  expect(localStorage.getItem('enterprisePrintersDB')).not.toBeNull();
});
```

- [ ] **Step 3: รัน test ให้ fail**

Run: `pnpm exec vitest run tests/printer-cache.test.ts`

Expected: FAIL เพราะ cache modules ยังไม่มี

- [ ] **Step 4: สร้าง native IndexedDB adapter**

async function readSnapshot(database: IDBDatabase, key: string) {
  return new Promise<Printer[]>((resolve, reject) => {
    const transaction = database.transaction('snapshots', 'readonly');
    const request = transaction.objectStore('snapshots').get(key);
    request.onsuccess = () => resolve(normalizePrinterList(request.result));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

async function writeSnapshot(database: IDBDatabase, key: string, printers: Printer[]) {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('snapshots', 'readwrite');
    transaction.objectStore('snapshots').put(normalizePrinterList(printers), key);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

```ts
export interface PrinterCache {
  load(): Promise<Printer[]>;
  save(printers: Printer[]): Promise<void>;
}

export function createPrinterCache(factory: IDBFactory, databaseName = 'printer-management-pwa'): PrinterCache {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return {
    async load() { return readSnapshot(await open(), 'printers:v2'); },
    async save(printers) { await writeSnapshot(await open(), 'printers:v2', printers); },
  };
}
```


- [ ] **Step 5: สร้าง migration ที่ idempotent**

```ts
export async function migrateLegacyPrinterCache(storage: Storage, cache: PrinterCache) {
  const raw = storage.getItem('enterprisePrintersDB');
  if (!raw) return [];
  const printers = normalizePrinterList(JSON.parse(raw));
  await cache.save(printers);
  storage.removeItem('enterprisePrintersDB');
  storage.removeItem('enterprisePrintersDataVersion');
  return printers;
}
```

จับ JSON parse error แล้วคืน `[]` โดยไม่ลบ key; ลบ legacy keys หลัง `cache.save` สำเร็จเท่านั้น

- [ ] **Step 6: Verify และ commit**

Run: `pnpm exec vitest run tests/printer-cache.test.ts`

Expected: PASS

```powershell
git add package.json pnpm-lock.yaml src/services/printer-cache.ts src/services/legacy-cache-migration.ts tests/printer-cache.test.ts
git commit -m "feat: add resilient printer snapshot cache"
```

---

### Task 4: สร้าง reducer, selectors และ pagination contracts

**Files:**
- Create: `src/app/app-reducer.ts`
- Create: `src/features/printers/printer-selectors.ts`
- Create: `tests/app-reducer.test.ts`
- Create: `tests/printer-selectors.test.ts`

**Interfaces:**
- Produces: `AppState`, `AppAction`, `appReducer`, `initialAppState`, `selectFilteredPrinters`, `selectPagedPrinters`, `selectFleetStats`

- [ ] **Step 1: เขียน failing reducer/selector tests**

```ts
it('เก็บ dirty editor และ deferred refresh แยกจาก printer list', () => {
  const state = appReducer(initialAppState, { type: 'editor/open', mode: 'add' });
  expect(state.editor).toMatchObject({ mode: 'add', dirty: false });
});

it('ค้นหาแบบ case-insensitive ทุก field ที่ผู้ใช้รู้จัก', () => {
  const result = selectFilteredPrinters(fixtures, { query: 'warehouse', location: '', type: '', status: '', sort: { key: 'name', direction: 'asc' } });
  expect(result.every(item => item.location === 'Warehouse')).toBe(true);
});

it('สรุป total/online/offline/warning', () => {
  expect(selectFleetStats(fixtures)).toEqual({ total: 3, online: 1, offline: 1, warning: 1 });
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm exec vitest run tests/app-reducer.test.ts tests/printer-selectors.test.ts`

- [ ] **Step 3: สร้าง state/action union**

```ts
export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'local' | 'error';
export type CompactView = 'manage' | 'list';
export type AppAction =
  | { type: 'printers/replace'; printers: Printer[] }
  | { type: 'printers/upsert'; printer: Printer }
  | { type: 'printers/delete'; ids: string[] }
  | { type: 'filters/change'; patch: Partial<FilterState> }
  | { type: 'selection/toggle'; id: string }
  | { type: 'selection/clear' }
  | { type: 'editor/open'; mode: 'add' | 'edit'; printer?: Printer }
  | { type: 'editor/change'; draft: PrinterDraft }
  | { type: 'editor/close' }
  | { type: 'sync/status'; status: SyncStatus; message?: string; syncedAt?: string }
  | { type: 'view/change'; view: CompactView };
```

Reducer ต้อง reset selection/page เมื่อ replace/delete และห้าม mutate state เดิม

- [ ] **Step 4: สร้าง pure selectors**

`selectFilteredPrinters` ต้อง search `name`, `ip`, `location`, `type`, `note`; filter exact `location/type/status`; sort ด้วย `localeCompare('th', { numeric: true })`

`selectPagedPrinters(items, page, pageSize)` ต้อง clamp page และคืน `{ items, page, pageCount, total }`

- [ ] **Step 5: Verify และ commit**

```powershell
pnpm exec vitest run tests/app-reducer.test.ts tests/printer-selectors.test.ts
pnpm run typecheck
git add src/app/app-reducer.ts src/features/printers/printer-selectors.ts tests/app-reducer.test.ts tests/printer-selectors.test.ts
git commit -m "feat: add printer state and selectors"
```

---

### Task 5: เชื่อม startup, optimistic edits, debounce sync และ retry

**Files:**
- Create: `src/app/AppProvider.tsx`
- Create: `src/app/use-printer-sync.ts`
- Create: `tests/app-provider.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Produces: `useAppState()`, `useAppActions()`, `AppProvider`
- Consumes: `PrinterApi`, `PrinterCache`, `appReducer`

- [ ] **Step 1: เขียน failing integration tests ด้วย injected dependencies**

```tsx
const cached = normalizePrinter({ id: 'cached', name: 'Cached Printer', ip: '10.0.0.1' });
const server = normalizePrinter({ id: 'server', name: 'Server Printer', ip: '10.0.0.2' });
const next = normalizePrinter({ id: 'next', name: 'Local Edit', ip: '10.0.0.3' });
const now = () => new Date('2026-08-16T08:00:00Z');

function Probe() {
  const state = useAppState();
  return <>{state.printers.map(item => <span key={item.id}>{item.name}</span>)}<span>{state.sync.message}</span></>;
}

function SaveProbe({ printer }: { printer: Printer }) {
  const state = useAppState();
  const actions = useAppActions();
  return <><button onClick={() => actions.savePrinter(printer)}>save</button><span>{state.sync.message}</span>{state.printers.map(item => <span key={item.id}>{item.name}</span>)}</>;
}

it('แสดง cache ก่อน แล้วแทนด้วย server snapshot', async () => {
  const cache = { load: vi.fn().mockResolvedValue([cached]), save: vi.fn() };
  const api = { load: vi.fn().mockResolvedValue({ printers: [server], syncedAt: '2026-08-16T08:00:00Z' }), save: vi.fn() };
  render(<AppProvider dependencies={{ api, cache, now }}><Probe /></AppProvider>);
  expect(await screen.findByText('Cached Printer')).toBeInTheDocument();
  expect(await screen.findByText('Server Printer')).toBeInTheDocument();
});

it('sync fail แล้วคง local edit และเปิด retry', async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const cache = { load: vi.fn().mockResolvedValue([]), save: vi.fn().mockResolvedValue(undefined) };
  const api = { load: vi.fn().mockResolvedValue({ printers: [], syncedAt: '' }), save: vi.fn().mockRejectedValue(new Error('offline')) };
  render(<AppProvider dependencies={{ api, cache, now }}><SaveProbe printer={next} /></AppProvider>);
  await user.click(screen.getByRole('button', { name: 'save' }));
  await vi.advanceTimersByTimeAsync(400);
  expect(await screen.findByText('บันทึกไม่สำเร็จ')).toBeInTheDocument();
  expect(screen.getByText(next.name)).toBeInTheDocument();
  vi.useRealTimers();
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm exec vitest run tests/app-provider.test.tsx`

- [ ] **Step 3: สร้าง provider พร้อม startup flow**

```tsx
type AppContextValue = { state: AppState; dispatch: Dispatch<AppAction>; dependencies: AppDependencies };
const AppContext = createContext<AppContextValue | null>(null);
export interface AppDependencies { api: PrinterApi; cache: PrinterCache; now: () => Date; }

export function AppProvider({ dependencies, children }: PropsWithChildren<{ dependencies: AppDependencies }>) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  useEffect(() => {
    let active = true;
    void (async () => {
      const cachedPrinters = await dependencies.cache.load();
      if (!active) return;
      if (cachedPrinters.length) dispatch({ type: 'printers/replace', printers: cachedPrinters });
      try {
        const result = await dependencies.api.load();
        if (!active) return;
        dispatch({ type: 'printers/replace', printers: result.printers });
        await dependencies.cache.save(result.printers);
        dispatch({ type: 'sync/status', status: 'synced', syncedAt: result.syncedAt });
      } catch {
        if (active) dispatch({ type: 'sync/status', status: 'local', message: 'ข้อมูลสำรองในเครื่อง' });
      }
    })();
    return () => { active = false; };
  }, [dependencies]);
  return <AppContext.Provider value={{ state, dispatch, dependencies }}>{children}</AppContext.Provider>;
}

function useAppContext() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider is missing');
  return value;
}

export function useAppState() { return useAppContext().state; }

export function useAppActions() {
  const { state, dispatch, dependencies } = useAppContext();
  const sync = usePrinterSync({ state, dispatch, dependencies });
  return {
    savePrinter(printer: Printer) {
      const action = { type: 'printers/upsert', printer } as const;
      const next = appReducer(state, action);
      dispatch(action);
      void dependencies.cache.save(next.printers);
      sync.queue(next.printers);
    },
    deletePrinters(ids: string[]) {
      const action = { type: 'printers/delete', ids } as const;
      const next = appReducer(state, action);
      dispatch(action);
      void dependencies.cache.save(next.printers);
      sync.queue(next.printers);
    },
    retry: sync.retry,
  };
}
```

ก่อน `cache.load` ให้เรียก migration เมื่อ cache ว่าง

- [ ] **Step 4: สร้าง write queue และ deferred refresh**

`usePrinterSync` ต้อง:

```ts
function queueSync(printers: Printer[]) {
  window.clearTimeout(timer.current);
  timer.current = window.setTimeout(() => saveSnapshot('syncPrinters', printers), 400);
}

async function retry() {
  await saveSnapshot('syncPrinters', stateRef.current.printers);
}
```

เมื่อ editor dirty ให้ตั้ง `deferredRefresh=true`; หลัง save/cancel ให้ refresh และ clear flag

- [ ] **Step 5: Verify และ commit**

```powershell
pnpm exec vitest run tests/app-provider.test.tsx
pnpm exec vitest run tests/printers-api.test.ts tests/printer-cache.test.ts
git add src/app/AppProvider.tsx src/app/use-printer-sync.ts src/app/App.tsx tests/app-provider.test.tsx
git commit -m "feat: add resilient printer data lifecycle"
```

---

### Task 6: สร้าง Theme engine และ design tokens

**Files:**
- Create: `src/features/theme/theme-config.ts`
- Create: `src/features/theme/theme-storage.ts`
- Create: `src/features/theme/ThemeProvider.tsx`
- Create: `src/styles/tokens.css`, `src/styles/themes.css`
- Create: `tests/theme-engine.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `ThemePreset`, `ThemeState`, `normalizeThemeState`, `THEME_DEFAULTS`, `useTheme()`

- [ ] **Step 1: เขียน failing theme tests**

```tsx
it('fallback เป็น Netflix dark 88/12 และ clamp ค่า', () => {
function ThemeProbe() {
  const theme = useTheme();
  return <button onClick={() => theme.selectPreset('netflix')}>Netflix</button>;
}

  expect(normalizeThemeState({})).toEqual({ preset: 'netflix', surface: 'dark', opacity: 88, blur: 12, customImageUrl: null });
  expect(normalizeThemeState({ opacity: 999, blur: -2 })).toMatchObject({ opacity: 100, blur: 0 });
});

it('เลือก Netflix บังคับ dark แต่ยังสลับ light ภายหลังได้', async () => {
  render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Netflix' }));
  expect(document.documentElement).toHaveAttribute('data-surface', 'dark');
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm exec vitest run tests/theme-engine.test.tsx`

- [ ] **Step 3: สร้าง config แบบ immutable**
export type ThemePreset = 'mint' | 'neon' | 'rose' | 'sunset' | 'netflix' | 'luxury';
export interface ThemeState {
  preset: ThemePreset;
  surface: 'dark' | 'light';
  opacity: number;
  blur: number;
  customImageUrl: string | null;
}


```ts
export const THEME_DEFAULTS = Object.freeze({ preset: 'netflix', surface: 'dark', opacity: 88, blur: 12, customImageUrl: null });
export const THEME_PRESETS = Object.freeze({
  mint: { accent: '#10B981', strong: '#059669' },
  neon: { accent: '#6366F1', strong: '#4F46E5' },
  rose: { accent: '#F43F5E', strong: '#E11D48' },
  sunset: { accent: '#F97316', strong: '#EA580C' },
  netflix: { accent: '#E50914', strong: '#B20710' },
  luxury: { accent: '#F59E0B', strong: '#D97706' },
} as const);
```

`normalizeThemeState` ต้อง validate preset/surface, clamp number และไม่โหลด custom image จาก storage

- [ ] **Step 4: ใช้ theme state กับ document root**

```ts
const root = document.documentElement;
root.dataset.preset = state.preset;
root.dataset.surface = state.surface;
root.style.setProperty('--theme-opacity', String(state.opacity / 100));
root.style.setProperty('--theme-blur', `${state.blur}px`);
root.style.setProperty('--theme-accent', token.accent);
export interface ThemeContextValue {
  state: ThemeState;
  selectPreset(preset: ThemePreset): void;
  setSurface(surface: ThemeState['surface']): void;
  setOpacity(opacity: number): void;
  setBlur(blur: number): void;
  setCustomImage(file: File | null): void;
  reset(): void;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider is missing');
  return value;
}
root.style.setProperty('--theme-accent-strong', token.strong);
```

บันทึก primitive ที่ normalize แล้วใน `printerThemeSettings`

- [ ] **Step 5: สร้าง base tokens และ reduced-motion contract**

```css
:root {
  --canvas: #07090d;
  --surface: #10151d;
  --paper: #f5f7fa;
  --success: #2dd4a8;
  --warning: #f3b33d;
  --control-height: 44px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- [ ] **Step 6: Verify และ commit**

```powershell
pnpm exec vitest run tests/theme-engine.test.tsx
pnpm run typecheck
git add src/features/theme src/styles/tokens.css src/styles/themes.css src/main.tsx tests/theme-engine.test.tsx
git commit -m "feat: add six-preset theme engine"
```

---

### Task 7: สร้าง AppShell, Print Rail และ responsive navigation

**Files:**
- Create: `src/app/AppShell.tsx`
- Create: `src/features/fleet/PrintRail.tsx`, `src/features/fleet/FleetOverview.tsx`
- Create: `src/components/Button/Button.tsx`, `src/components/ToastRegion/ToastRegion.tsx`
- Create: `src/styles/responsive.css`
- Create: `tests/app-layout.test.tsx`
- Modify: `src/app/App.tsx`, `src/main.tsx`

**Interfaces:**
- `PrintRail({ stats, sync, onRetry })`
- `AppShell({ manage, list, headerActions })`

- [ ] **Step 1: เขียน failing layout tests**

```tsx
it('Print Rail แสดงข้อมูลจริงและ retry เมื่อ sync error', async () => {
  const retry = vi.fn();
  const user = userEvent.setup();
  render(<PrintRail stats={{ total: 8, online: 5, offline: 3, warning: 0 }} sync={{ status: 'error', syncedAt: '' }} onRetry={retry} />);
  expect(screen.getByText('5 พร้อมใช้')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
  expect(retry).toHaveBeenCalled();
});

it('compact navigation มี 2 แท็บเท่านั้น', () => {
  render(<AppShell manage={<div />} list={<div />} headerActions={null} />);
  expect(screen.getByRole('navigation', { name: 'เมนูหลัก' }).querySelectorAll('button')).toHaveLength(2);
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm exec vitest run tests/app-layout.test.tsx`

- [ ] **Step 3: สร้าง semantic shell และ Print Rail**

Print Rail labels ต้อง map ดังนี้:

```ts
const syncLabels = {
  loading: 'กำลังเชื่อมต่อชีต…',
  saving: 'กำลังบันทึก…',
  synced: 'ข้อมูลล่าสุดจากชีต',
  local: 'ข้อมูลสำรองในเครื่อง',
  error: 'บันทึกไม่สำเร็จ',
  idle: 'ยังไม่ได้ซิงก์',
} satisfies Record<SyncStatus, string>;
```

ใช้ `<header>`, `<main>`, `<nav aria-label="เมนูหลัก">` และ `role="status" aria-live="polite"`

- [ ] **Step 4: สร้าง responsive CSS contracts**

```css
.mobile-tabbar { display: none; }
@media (max-width: 1024px) {
  .desktop-only { display: none !important; }
  .mobile-tabbar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); padding-bottom: env(safe-area-inset-bottom); }
}
@media (min-width: 1025px) {
  .compact-only { display: none !important; }
}
button, input, select, textarea { min-height: var(--control-height); }
html, body, #root { min-width: 0; overflow-x: clip; }
```

Scanning line ใช้ animation เฉพาะ `sync.status === 'loading' || 'saving'`

- [ ] **Step 5: Verify และ commit**

```powershell
pnpm exec vitest run tests/app-layout.test.tsx
pnpm run typecheck
git add src/app src/features/fleet src/components/Button src/components/ToastRegion src/styles/responsive.css src/main.tsx tests/app-layout.test.tsx
git commit -m "feat: build responsive fleet command shell"
```

---

### Task 8: สร้าง search/filter/table/cards/pagination/bulk selection

**Files:**
- Create: `src/features/printers/PrinterFilters.tsx`
- Create: `src/features/printers/PrinterTable.tsx`
- Create: `src/features/printers/PrinterCardList.tsx`
- Create: `src/features/printers/BulkActionBar.tsx`
- Create: `src/features/printers/PrinterBrowse.tsx`
- Create: `tests/printer-browse.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- `PrinterBrowse({ printers, filters, selection, onFilterChange, onSort, onSelect, onEdit, onDelete })`

- [ ] **Step 1: เขียน failing browse tests**

```tsx
it('table และ compact cards ใช้ printer dataset เดียวกัน', () => {
const fixtures = [normalizePrinter({ id: 'p1', name: 'Printer 1', ip: '10.0.0.1', location: 'Warehouse' })];
const props = {
  filters: DEFAULT_FILTERS,
  selection: new Set<string>(),
  onFilterChange: vi.fn(),
  onSort: vi.fn(),
  onSelect: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};
const deleteMany = vi.fn();
const clear = vi.fn();

  render(<PrinterBrowse {...props} printers={fixtures} />);
  expect(screen.getAllByText('10.0.0.1').length).toBeGreaterThanOrEqual(2);
});

it('filter และ clear search ใช้ accessible controls', async () => {
  render(<PrinterBrowse {...props} printers={fixtures} />);
  const user = userEvent.setup();
  await user.type(screen.getByRole('searchbox', { name: 'ค้นหาเครื่องพิมพ์' }), 'warehouse');
  expect(props.onFilterChange).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'warehouse' }));
});

it('bulk action ระบุจำนวนที่เลือก', () => {
  render(<BulkActionBar selectedCount={3} onDelete={deleteMany} onClear={clear} />);
  expect(screen.getByText('เลือกแล้ว 3 เครื่อง')).toBeInTheDocument();
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm exec vitest run tests/printer-browse.test.tsx`

- [ ] **Step 3: สร้าง desktop table**

Columns: selection, ชื่อเครื่อง, IP, สถานที่, รุ่น/ประเภท, สถานะ, อัปเดตล่าสุด, หมายเหตุ, จัดการ

ใช้ `<th scope="col">`, sortable button พร้อม `aria-sort`, sticky header และ icon-only actions ที่มี `aria-label="แก้ไข {name}"`/`ลบ {name}`

- [ ] **Step 4: สร้าง compact card list**

Card ต้องแสดง 3 กลุ่มข้อมูลโดยไม่ย่อ table DOM:

```tsx
<article className="printer-card">
  <header><StatusBadge status={printer.status} /><h3>{printer.name}</h3></header>
  <code>{printer.ip}</code>
  <p>{printer.location} · {printer.type}</p>
  <div className="printer-card__actions">
    <button aria-label={`แก้ไข ${printer.name}`} onClick={() => onEdit(printer)}>แก้ไข</button>
    <button aria-label={`ลบ ${printer.name}`} onClick={() => onDelete(printer)}>ลบ</button>
  </div>
</article>
```

- [ ] **Step 5: เชื่อม selectors/pagination/selection**

ใช้ `selectFilteredPrinters` และ `selectPagedPrinters`; เมื่อ filter เปลี่ยนให้ reset page เป็น 1; bulk select เลือกเฉพาะ visible page และ selected ids ที่ยังมีอยู่

- [ ] **Step 6: Verify และ commit**

```powershell
pnpm exec vitest run tests/printer-browse.test.tsx tests/printer-selectors.test.ts
pnpm run typecheck
git add src/features/printers src/app/App.tsx tests/printer-browse.test.tsx
git commit -m "feat: add responsive printer browsing"
```

---

### Task 9: เพิ่ม editor, CRUD validation และ destructive confirmation

**Files:**
- Create: `src/features/printers/printer-validation.ts`
- Create: `src/features/printers/PrinterEditor.tsx`
- Create: `src/features/printers/DeletePrinterDialog.tsx`
- Create: `src/components/Drawer/Drawer.tsx`, `src/components/Dialog/Dialog.tsx`
- Create: `tests/printer-editor.test.tsx`
- Modify: `src/app/App.tsx`, `src/app/AppProvider.tsx`

**Interfaces:**
- Produces: `validatePrinterDraft(draft): FieldErrors`, `PrinterEditor({ mode, initial, onSave, onCancel })`
- Consumes: `actions.savePrinter`, `actions.deletePrinters`

- [ ] **Step 1: เขียน failing validation/editor tests**

```tsx
const save = vi.fn();
const cancel = vi.fn();
it('name/ip/location/type ว่างแล้วไม่บันทึก', async () => {
  const user = userEvent.setup();
  render(<PrinterEditor mode="add" initial={EMPTY_DRAFT} onSave={save} onCancel={cancel} />);
  await user.click(screen.getByRole('button', { name: 'เพิ่มเครื่องพิมพ์' }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText('กรอกชื่อเครื่องพิมพ์')).toBeInTheDocument();
});

it('dirty editor ต้องยืนยันก่อนปิด', async () => {
  const user = userEvent.setup();
  render(<PrinterEditor mode="add" initial={EMPTY_DRAFT} onSave={save} onCancel={cancel} />);
  await user.type(screen.getByLabelText('ชื่อเครื่องพิมพ์'), 'P1');
  await user.click(screen.getByRole('button', { name: 'ปิด' }));
  expect(screen.getByRole('dialog', { name: 'ทิ้งการเปลี่ยนแปลง?' })).toBeInTheDocument();
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm exec vitest run tests/printer-editor.test.tsx`

- [ ] **Step 3: สร้าง validation และ ID generation**

```ts
export function validatePrinterDraft(draft: PrinterDraft) {
  return {
    name: draft.name.trim() ? '' : 'กรอกชื่อเครื่องพิมพ์',
    ip: draft.ip.trim() ? '' : 'กรอก IP Address',
    location: draft.location.trim() ? '' : 'กรอกสถานที่',
    type: draft.type.trim() ? '' : 'กรอกรุ่นหรือประเภท',
  };
}

export const createPrinterId = () => crypto.randomUUID();
```

ห้ามบังคับ regex IP ที่เข้มกว่า backend เพราะข้อมูลเดิมอาจใช้ hostname/รูปแบบภายใน

- [ ] **Step 4: สร้าง Drawer/Dialog ที่จัดการ focus**

Drawer desktop กว้าง `clamp(360px, 34vw, 480px)`; compact ใช้ full-height sheet ภายใน viewport ใช้ native `<dialog>` หรือ focus trap ที่มี return-focus test

- [ ] **Step 5: เชื่อม optimistic CRUD และ delete confirm**

Single delete copy: `ลบ {name}?` Bulk delete copy: `ลบเครื่องพิมพ์ {count} รายการ?` ปุ่มยืนยันใช้ `ลบรายการ` และต้องเรียก `actions.deletePrinters(ids)` ครั้งเดียว

- [ ] **Step 6: Verify และ commit**

```powershell
pnpm exec vitest run tests/printer-editor.test.tsx tests/app-provider.test.tsx
pnpm run typecheck
git add src/features/printers src/components/Drawer src/components/Dialog src/app tests/printer-editor.test.tsx
git commit -m "feat: add safe printer CRUD workflows"
```

---

### Task 10: ย้าย CSV, TCP scan/import และ manual sheet sync

**Files:**
- Create: `src/features/tools/csv-tools.ts`
- Create: `src/features/tools/tcp-tools.ts`
- Create: `src/features/tools/DatabaseTools.tsx`
- Create: `tests/database-tools.test.ts`
- Create: `tests/database-tools-ui.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Produces: `serializePrintersCsv`, `getExportFilename`, `buildTcpScanScript`, `parseTcpResults`, `applyTcpResults`

- [ ] **Step 1: เขียน failing pure utility tests**

```ts
const printer = normalizePrinter({ id: 'p1', name: 'Printer 1', ip: '10.0.0.1' });

it('CSV มี BOM/header เดิมและ escape quote', () => {
  const csv = serializePrintersCsv([{ ...printer, note: 'หมึก "ใกล้หมด"' }]);
  expect(csv.startsWith('\uFEFFName,IP,Location,Type,Status,LastUpdated,Note\n')).toBe(true);
  expect(csv).toContain('"หมึก ""ใกล้หมด"""');
});

it('TCP script ตรวจ port 9100 และ 80 เท่านั้น', () => {
  const script = buildTcpScanScript(['10.0.0.1']);
  expect(script).toContain('$ports = @(9100, 80)');
  expect(script).toContain('Set-Clipboard');
});

it('import รับเฉพาะ array ที่มี ip/status string', () => {
  expect(parseTcpResults('[{"ip":"10.0.0.1","status":"online"}]')).toEqual([{ ip: '10.0.0.1', status: 'online' }]);
  expect(() => parseTcpResults('{"ip":"10.0.0.1"}')).toThrow();
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm exec vitest run tests/database-tools.test.ts tests/database-tools-ui.test.tsx`

- [ ] **Step 3: สร้าง utilities โดยคง output format เดิม**

`serializePrintersCsv` ต้องเรียง columns `Name,IP,Location,Type,Status,LastUpdated,Note` และ escape ด้วย `String(value).replaceAll('"', '""')`

`buildTcpScanScript` ต้อง filter IPv4 แบบเดิม, ใช้ timeout 1000ms, ports 9100/80 และคืน JSON `{ ip, status }` ไป clipboard

`applyTcpResults` ต้องคืน `{ printers, updatedCount }`, match ด้วย IP และอัปเดต `lastUpdated` timestamp เดียวกันทั้ง batch

- [ ] **Step 4: สร้าง DatabaseTools UI และ clipboard fallback**

ปุ่ม 4 รายการ: `ซิงก์กับชีต`, `Export CSV`, `1. สคริปต์ TCP`, `2. อัปเดตสถานะ`

ใช้ `navigator.clipboard.writeText/readText`; ถ้าถูกบล็อก เปิด dialog textarea สำหรับ manual copy/paste โดยไม่ใช้ `document.execCommand`

- [ ] **Step 5: เชื่อม manual sync**

ปุ่ม sync เรียก `saveSnapshot('saveToSheet', currentPrinters)` และแสดง `ส่งข้อมูลไปยังชีตแล้ว` หรือ `ไม่สามารถเชื่อมต่อ Google Sheets ได้ ข้อมูลยังเก็บอยู่ในเครื่อง`

- [ ] **Step 6: Verify และ commit**

```powershell
pnpm exec vitest run tests/database-tools.test.ts tests/database-tools-ui.test.tsx
pnpm run typecheck
git add src/features/tools src/app/App.tsx tests/database-tools.test.ts tests/database-tools-ui.test.tsx
git commit -m "feat: migrate printer database tools"
```

---

### Task 11: สร้าง Theme Studio และ custom image lifecycle

**Files:**
- Create: `src/features/theme/ThemeStudio.tsx`
- Create: `src/features/theme/ThemePreview.tsx`
- Create: `tests/theme-studio-ui.test.tsx`
- Modify: `src/features/fleet/FleetOverview.tsx`, `src/app/App.tsx`, `src/styles/themes.css`

**Interfaces:**
- Consumes: `useTheme()`
- Produces: accessible dialog, preset/surface controls, opacity/blur ranges, session image preview

- [ ] **Step 1: เขียน failing Theme Studio UI tests**

```tsx
const close = vi.fn();

it('มี 6 presets พร้อม aria-pressed', () => {
  render(<ThemeProvider><ThemeStudio open onClose={close} /></ThemeProvider>);
  for (const name of ['Mint', 'Neon', 'Rose', 'Sunset', 'Netflix', 'Luxury']) {
    expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed');
  }
});

  const user = userEvent.setup();
it('reset คืน Netflix dark 88/12', async () => {
  render(<ThemeProvider><ThemeStudio open onClose={close} /></ThemeProvider>);
  await user.click(screen.getByRole('button', { name: 'คืนค่าเริ่มต้น' }));
  expect(screen.getByLabelText('ความทึบของการ์ด')).toHaveValue('88');
  expect(screen.getByLabelText('ความเบลอพื้นหลัง')).toHaveValue('12');
});

it('revoke object URL เมื่อเปลี่ยนภาพ', async () => {
  const user = userEvent.setup();
  vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:file-a').mockReturnValueOnce('blob:file-b');
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  render(<ThemeProvider><ThemeStudio open onClose={close} /></ThemeProvider>);
  const input = screen.getByLabelText('รูปพื้นหลังการ์ด');
  await user.upload(input, new File(['a'], 'a.png', { type: 'image/png' }));
  await user.upload(input, new File(['b'], 'b.png', { type: 'image/png' }));
  expect(revoke).toHaveBeenCalledWith('blob:file-a');
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm exec vitest run tests/theme-studio-ui.test.tsx`

- [ ] **Step 3: สร้าง controls และ live preview**

ใช้ `role="group" aria-label="เลือก preset ธีม"`, `aria-pressed` บน preset/surface, range outputs ที่อัปเดต `88%`/`12px` และ status `aria-live="polite"`

- [ ] **Step 4: จำกัด custom image target**

ตั้ง `--fleet-card-image: url("...")` เฉพาะ `.theme-preview` และ `.fleet-overview__hero`; ห้ามมี selector ที่ตั้ง `body { background-image: var(--fleet-card-image) }`

เมื่อ upload/remove/unmount ให้ revoke URL เก่า และห้ามเขียน URL/Base64 ลง localStorage

- [ ] **Step 5: เพิ่ม contract test แทน regex test เดิม**

Port `tests/theme-studio.test.cjs` ไปตรวจ `theme-config.ts`/component behavior แล้วลบ regex ที่อ้าง `Index.html`

- [ ] **Step 6: Verify และ commit**

```powershell
pnpm exec vitest run tests/theme-engine.test.tsx tests/theme-studio-ui.test.tsx
pnpm run typecheck
git add src/features/theme src/features/fleet/FleetOverview.tsx src/app/App.tsx src/styles/themes.css tests/theme-studio-ui.test.tsx tests/theme-studio.test.cjs
git commit -m "feat: build accessible Theme Studio"
```

---

### Task 12: ย้าย assets และเพิ่ม generated PWA integration

**Files:**
- Move: `assets/` → `public/assets/`
- Delete: `manifest.webmanifest`
- Delete: `service-worker.js`
- Modify: `vite.config.ts`, `vercel.json`, `package.json`, `pnpm-lock.yaml`
- Create: `src/pwa/UpdatePrompt.tsx`
- Create: `tests/pwa-config.test.ts`
- Modify: `tests/pwa-shell.test.cjs`, `tests/pwa-icons.test.cjs`, `tests/repository-hygiene.test.cjs`, `scripts/generate-pwa-icons.py`

**Interfaces:**
- Produces: generated service worker, `useRegisterSW`, update prompt
- Consumes: existing icon files and manifest metadata

- [ ] **Step 1: ติดตั้ง PWA dependencies และเขียน failing config test**

Run: `pnpm add -D vite-plugin-pwa @playwright/test`

```ts
it('manifest ใช้ Netflix default colors และ icon เดิม', () => {
  expect(pwaOptions.manifest).toMatchObject({
    name: 'Printer Management Pro', short_name: 'Printer Pro', lang: 'th',
    background_color: '#07090D', theme_color: '#E50914', display: 'standalone',
  });
});

it('API ไม่อยู่ใน runtime caching', () => {
  expect(JSON.stringify(pwaOptions.workbox)).not.toContain('/api/printers');
});
```

- [ ] **Step 2: รัน test ให้ fail**

Run: `pnpm exec vitest run tests/pwa-config.test.ts`

- [ ] **Step 3: ย้าย static assets และปรับ generator/tests**

ใช้ `git mv assets public/assets`; ปรับ `scripts/generate-pwa-icons.py` และ icon tests ให้ใช้ `public/assets/icons`; ลบ static `manifest.webmanifest` หลังย้าย metadata เข้า `pwaOptions` และห้าม regenerate PNG ถ้า source pixels ไม่เปลี่ยน

- [ ] **Step 4: กำหนด VitePWA config**

```ts
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'prompt',
import type { VitePWAOptions } from 'vite-plugin-pwa';

  includeAssets: ['assets/icons/favicon.ico', 'assets/icons/apple-touch-icon.png', 'assets/icons/safari-pinned-tab.svg'],
  manifest: {
    id: '/', name: 'Printer Management Pro', short_name: 'Printer Pro',
    description: 'ระบบจัดการและติดตามสถานะเครื่องพิมพ์', lang: 'th', start_url: '/', scope: '/', display: 'standalone',
    background_color: '#07090D', theme_color: '#E50914',
    icons: [
      { src: '/assets/icons/icon-any-192-v3.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/assets/icons/icon-any-512-v3.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/assets/icons/icon-maskable-192-v2.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/assets/icons/icon-maskable-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: { navigateFallback: '/index.html', runtimeCaching: [] },
};
```

- [ ] **Step 5: สร้าง update prompt ที่ป้องกัน dirty draft**

`UpdatePrompt` แสดง `มีเวอร์ชันใหม่` และปุ่ม `อัปเดตตอนนี้`; ถ้า editor dirty ให้ disable reload พร้อมข้อความ `บันทึกหรือยกเลิกฟอร์มก่อนอัปเดต`

- [ ] **Step 6: ปรับ Vercel config**

ลบ rewrite `/ → /Index.html`; ตั้ง build output ผ่าน Vite และ header `Cache-Control: no-cache` สำหรับ `/sw.js`/service-worker generated path ส่วน API function เดิมต้องยัง resolve ที่ `/api/printers`

- [ ] **Step 7: Verify และ commit**

```powershell
pnpm exec vitest run tests/pwa-config.test.ts
node tests/pwa-icons.test.cjs
node tests/repository-hygiene.test.cjs
pnpm run build
git add public src/pwa vite.config.ts vercel.json package.json pnpm-lock.yaml scripts tests manifest.webmanifest service-worker.js assets
git commit -m "feat: integrate generated offline PWA shell"
```

---

### Task 13: Responsive E2E, accessibility, legacy cleanup และ full verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/fixtures/printers.ts`, `e2e/fixture-server.ts`
- Create: `e2e/fleet-command-center.spec.ts`, `e2e/theme-matrix.spec.ts`
- Replace: `tests/target-viewport-responsive.test.cjs`, `tests/mobile-browser.test.cjs`, `tests/material-liquid-glass.test.cjs`
- Delete after equivalent coverage: `tests/header-watermark.test.cjs`, `tests/mobile-two-tab.test.cjs`, `tests/responsive-layout.test.cjs`
- Modify: `tests/repository-hygiene.test.cjs`, `tests/pwa-shell.test.cjs`
- Modify: UI/styles ที่ visual QA พบเฉพาะจุด

**Interfaces:**
- Produces: reproducible local fixture environment และ final acceptance evidence

- [ ] **Step 1: สร้าง Playwright fixture server ที่ไม่แตะ backend จริง**

`e2e/fixture-server.ts` ต้องเสิร์ฟ `dist/` และ intercept `/api/printers`:

```ts
const FIXED_TIME = '2026-08-16T08:00:00.000Z';
type PrinterWritePayload = ReturnType<typeof buildPrinterWritePayload>;
const writes: PrinterWritePayload[] = [];

function sendJson(response: ServerResponse, data: unknown) {
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

if (request.url === '/api/printers' && request.method === 'GET') {
  return sendJson(response, { ok: true, schemaVersion: 2, syncedAt: FIXED_TIME, printers: fixtures });
}
if (request.url === '/api/printers' && request.method === 'POST') {
  const body = await readRequestBody(request);
  const payload = JSON.parse(body) as PrinterWritePayload;
  writes.push(payload);
  return sendJson(response, { ok: true, syncedRows: payload.printers.length, syncedAt: FIXED_TIME });
}
```

- [ ] **Step 2: เขียน failing responsive acceptance test**

```ts
for (const viewport of [
  [360,800], [390,844], [430,932], [768,1024], [820,1180],
  [1024,768], [1025,768], [1280,800], [1440,900],
] as const) {
  test(`${viewport[0]}x${viewport[1]} ไม่ล้นและ controls แตะได้`, async ({ page }) => {
    await page.setViewportSize({ width: viewport[0], height: viewport[1] });
    await page.goto('/');
    const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth }));
    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(await page.locator('button:visible').evaluateAll(nodes => Math.min(...nodes.map(node => node.getBoundingClientRect().height)))).toBeGreaterThanOrEqual(44);
  });
}
```

- [ ] **Step 3: เพิ่ม complete-flow tests**

ครอบคลุม:

```text
startup cache → GET snapshot
search/filter/sort/pagination
add → edit → delete → bulk delete
CSV download
TCP script copy/manual fallback → import JSON
manual sync/retry error
Theme Studio 6 presets + Dark/Light + reset + custom image
compact 2 tabs และ desktop drawer
keyboard focus/escape/dirty guard
```

แต่ละ flow ต้อง assert POST payload ไม่มี `mac`, extra key, Apps Script URL หรือ secret

- [ ] **Step 4: เพิ่ม visual snapshots**

บันทึก baseline เฉพาะ:

```text
1440x900 Netflix desktop command center
820x1180 Netflix tablet list
390x844 Netflix mobile manage/list
390x844 Theme Studio
1440x900 Light Glass
```

ใช้ screenshot diff threshold คงที่และปิด animation/reduced motion ใน test

- [ ] **Step 5: ลบ legacy regex/browser tests หลัง coverage ใหม่ผ่าน**

ลบเฉพาะไฟล์ที่ระบุใน Files หลัง `e2e/fleet-command-center.spec.ts`, `e2e/theme-matrix.spec.ts`, component tests และ PWA tests ครอบคลุม behavior เดิมแล้ว เก็บ `apps-script-api`, `vercel-api`, `sheet-schema`, `pwa-icons` และ repository security contracts

- [ ] **Step 6: รัน full verification**

Run:

```powershell
pnpm run typecheck
pnpm run lint
pnpm run test:run
node tests/apps-script-api.test.cjs
node tests/vercel-api.test.cjs
node tests/sheet-schema.test.cjs
node tests/pwa-icons.test.cjs
node tests/repository-hygiene.test.cjs
pnpm run build
pnpm run test:e2e
git diff --check
git status --short
```

Expected: ทุกคำสั่ง PASS, ไม่มี horizontal overflow/touch-target failure, ไม่มี secret/MAC ใน client bundle และ status แสดงเฉพาะไฟล์ที่ตั้งใจแก้

- [ ] **Step 7: ตรวจ diff และ commit**

```powershell
git add e2e playwright.config.ts src tests package.json pnpm-lock.yaml
git commit -m "test: verify fleet command center end to end"
```

---

## ลำดับ verification ขั้นสุดท้าย

1. `pnpm run typecheck`
2. `pnpm run lint`
3. `pnpm run test:run`
4. Contract tests ของ Apps Script/Vercel/schema/icons/security
5. `pnpm run build`
6. `pnpm run test:e2e`
7. ตรวจ screenshots ที่ viewport ตาม spec
8. `git diff --check` และ `git status --short`

ห้ามอ้างว่า rewrite เสร็จหรือ responsive 100% จนทุกข้อด้านบนผ่านจริงและตรวจภาพ desktop/tablet/mobile แล้ว
