# สเป็กออกแบบ Printer Fleet Command Center

## สถานะและการตัดสินใจ

- วันที่: 16 สิงหาคม 2026
- สถานะ: ผู้ใช้อนุมัติแบบออกแบบทั้ง 3 ส่วนแล้ว รอรีวิวเอกสารฉบับนี้ก่อนทำ implementation plan
- แนวทางที่เลือก: รื้อ frontend ใหม่ด้วย React + TypeScript + Vite
- Backend: คง `api/printers.js`, `Code.gs`, Google Sheet schema และ environment variables เดิม
- Production frontend: deploy ผ่าน Vercel; Apps Script ทำหน้าที่เป็น upstream data service เท่านั้น
- Theme เริ่มต้น: Netflix + Dark Glass + opacity 88% + blur 12px
- Theme ที่รองรับ: Mint, Neon, Rose, Sunset, Netflix และ Luxury
- Compact layout: คง navigation 2 แท็บ `จัดการ` และ `รายการ` สำหรับ viewport ไม่เกิน 1024px

## เป้าหมาย

1. เปลี่ยนหน้าเว็บจาก `Index.html` แบบ monolithic เป็น frontend ที่แบ่ง component และทดสอบได้
2. ทำให้หน้าตาเป็นศูนย์ควบคุม fleet เครื่องพิมพ์ที่อ่านง่าย ใช้งานเร็ว และไม่เหมือน dashboard template ทั่วไป
3. ให้ทั้ง 6 preset เปลี่ยนสี accent, canvas, surface, focus ring และสถานะของทั้งแอปอย่างสม่ำเสมอ
4. รองรับ desktop, tablet และ mobile โดยไม่มี horizontal scroll และมี touch target อย่างน้อย 44px
5. รักษา CRUD, bulk delete, filters, sorting, pagination, CSV, TCP workflow, Google Sheet sync, Theme Studio และ PWA
6. รักษาสัญญาข้อมูลและความปลอดภัยของ backend เดิมโดยไม่เปิดเผย secret หรือ Apps Script URL ฝั่ง client

## นอกขอบเขต

- ไม่เปลี่ยน Google Sheet schema, authentication, Apps Script secret หรือ Vercel environment variables
- ไม่เปลี่ยนรูปแบบ API ให้เป็น record-level CRUD; backend ยังคงรับ snapshot เครื่องพิมพ์ทั้งชุด
- ไม่เพิ่มระบบบัญชีผู้ใช้, role, audit log หรือฐานข้อมูลใหม่
- ไม่เก็บ custom background image แบบถาวรหรือส่งภาพขึ้น backend
- ไม่เพิ่ม preset เกิน 6 รายการ

## แหล่งอ้างอิงและข้อจำกัดเดิม

- Theme behavior อ้างอิง `CARD-THEME-CONFIG.md`: 6 presets, Dark/Light Glass, opacity 40–100, blur 0–30, custom image เฉพาะ session และ local persistence ที่ validate ก่อนใช้
- API ฝั่ง client เรียกเฉพาะ `/api/printers`
- `GET /api/printers` ต้องใช้ `cache: "no-store"`
- `POST /api/printers` รองรับ action `syncPrinters` และ `saveToSheet`
- Printer record มีเฉพาะ `id`, `name`, `ip`, `location`, `type`, `status`, `lastUpdated`, `note` และทุกค่าเป็น string
- Backend จำกัดไม่เกิน 5,000 records และ payload ไม่เกิน 1 MB
- ไม่มีช่อง MAC Address และห้ามนำกลับมาใน UI หรือ payload

## Tech stack

### Runtime

- React แบบ functional components
- TypeScript แบบ strict
- Vite สำหรับ dev server และ production build
- CSS custom properties + CSS modules/feature styles โดยไม่ใช้ component library ขนาดใหญ่
- `vite-plugin-pwa` สำหรับ app shell precache และ service worker generation
- Fontsource สำหรับ bundle Chakra Petch และ IBM Plex Sans Thai ให้ใช้ได้เมื่อ offline

### Testing และคุณภาพ

- Vitest สำหรับ pure functions, reducers และ API adapter
- React Testing Library สำหรับ component behavior และ accessibility contracts
- Playwright สำหรับ responsive/e2e ด้วย mock API เท่านั้น
- ESLint และ TypeScript type-check
- Node contract tests เดิมของ `api/printers.js`, `Code.gs` และ sheet schema ต้องยังผ่าน

## โครงสร้างโค้ดเป้าหมาย

```text
index.html
src/
├─ main.tsx
├─ app/
│  ├─ App.tsx
│  ├─ AppShell.tsx
│  └─ app-reducer.ts
├─ components/
│  ├─ Button/
│  ├─ Dialog/
│  ├─ Drawer/
│  ├─ EmptyState/
│  ├─ StatusBadge/
│  └─ ToastRegion/
├─ features/
│  ├─ printers/
│  │  ├─ PrinterEditor.tsx
│  │  ├─ PrinterTable.tsx
│  │  ├─ PrinterCardList.tsx
│  │  ├─ PrinterFilters.tsx
│  │  ├─ BulkActionBar.tsx
│  │  └─ printer-utils.ts
│  ├─ fleet/
│  │  ├─ PrintRail.tsx
│  │  └─ FleetOverview.tsx
│  ├─ tools/
│  │  ├─ DatabaseTools.tsx
│  │  └─ tcp-tools.ts
│  └─ theme/
│     ├─ ThemeStudio.tsx
│     ├─ theme-context.tsx
│     ├─ theme-config.ts
│     └─ theme-storage.ts
├─ services/
│  ├─ printers-api.ts
│  ├─ printer-cache.ts
│  └─ legacy-cache-migration.ts
├─ styles/
│  ├─ tokens.css
│  ├─ themes.css
│  ├─ globals.css
│  └─ responsive.css
└─ types/
   └─ printer.ts
```

ไฟล์อาจถูกรวมเมื่อเนื้อหาสั้น แต่ boundary ระหว่าง app shell, printer feature, theme และ API/cache ต้องคงอยู่

## Component boundaries

### AppShell

- จัด layout desktop/compact และ mobile bottom navigation
- ไม่รู้รายละเอียด API หรือ local storage
- ควบคุม active compact tab และ drawer/dialog ที่เปิดอยู่

### Printers feature

- รับ printer state และ callbacks ผ่าน typed props/hooks
- แยก desktop table กับ compact card list โดยใช้ filtered/sorted dataset เดียวกัน
- `PrinterEditor` รับผิดชอบ validation และ draft state ไม่แก้ global stateจนกดบันทึก

### Fleet feature

- `PrintRail` แสดง total, online, offline, sync state และ last sync
- animation scanning line ทำงานเฉพาะระหว่าง sync และหยุดเมื่อ reduced motion
- `FleetOverview` สรุปข้อมูลที่ช่วยตัดสินใจ ไม่สร้าง KPI card ที่ซ้ำกับ Print Rail

### Theme feature

- เป็น state แยกจาก printer state
- ควบคุม CSS custom properties บน document root
- การเปลี่ยน theme ต้องไม่เรียก API หรือแก้ printer data

### Services

- `printers-api.ts` เป็นจุดเดียวที่เรียก `/api/printers`
- `printer-cache.ts` จัดการ IndexedDB โดยไม่รั่วรายละเอียด storage เข้า component
- API errors ถูกแปลงเป็น error code ฝั่ง UI ที่คาดเดาได้

## Data model และ API contract

```ts
type PrinterStatus = "online" | "offline" | "warning" | string;

interface Printer {
  id: string;
  name: string;
  ip: string;
  location: string;
  type: string;
  status: string;
  lastUpdated: string;
  note: string;
}

interface PrinterSnapshotResponse {
  ok: true;
  printers: Printer[];
  syncedAt?: string;
  schemaVersion?: number;
}
```

ทุก record จาก cache, API, CSV/TCP import และ form ต้องผ่าน normalizer เดียวกันก่อนเข้า app state โดยตัด key ที่ไม่รองรับและแปลงค่าที่อนุญาตเป็น string

### Read

```text
GET /api/printers
Accept: application/json
Cache: no-store
```

response ต้องมี `ok: true` และ `printers` เป็น array หากไม่ถูกต้องให้ถือว่า read ล้มเหลวและคง snapshot ในเครื่อง

### Write

```json
{
  "action": "syncPrinters",
  "source": "Printer Management Pro",
  "updatedAt": "ISO-8601",
  "printers": []
}
```

- background/debounced write ใช้ `syncPrinters`
- manual database sync ใช้ `saveToSheet`
- client ห้ามส่ง key อื่นเพราะ proxy ตรวจ payload แบบ allowlist
- UI ต้องไม่แสดง upstream URL, shared secret หรือ raw server error

## State และ data flow

### App state

```text
appState
├─ printers
├─ filters / sort / pagination
├─ selectedIds
├─ editorDraft / editorMode
├─ compactView: manage | list
├─ sync: idle | loading | saving | synced | local | error
└─ notifications

themeState
├─ preset: mint | neon | rose | sunset | netflix | luxury
├─ surface: dark | light
├─ opacity: 40..100
├─ blur: 0..30
└─ customImage: transient object URL | null
```

### Startup

1. อ่าน IndexedDB snapshot และแสดงทันทีถ้ามี
2. ถ้ายังไม่มี IndexedDB ให้ migrate `enterprisePrintersDB` จาก localStorage หนึ่งครั้ง
3. เรียก `GET /api/printers`
4. validate/normalize response แล้วแทนที่ app state และ IndexedDB snapshot
5. หาก request ล้มเหลว ให้คงข้อมูลในเครื่องและแสดงสถานะ `local` พร้อมปุ่มลองอีกครั้ง

### Create, edit, delete และ import

1. validate draft
2. อัปเดต app state แบบ optimistic
3. บันทึก IndexedDB snapshot
4. queue `syncPrinters` หลัง idle 400ms
5. เมื่อสำเร็จ แสดง `synced` และเวลา sync
6. เมื่อไม่สำเร็จ คงข้อมูล local, แสดง `error` และให้ retry; ห้ามทิ้งการแก้ไขของผู้ใช้

### Refresh conflict protection

- หาก editor มี draft ที่เปลี่ยนแล้ว ห้ามแทนที่ข้อมูลด้วย server refresh ทันที
- เก็บคำขอ refresh เป็น deferred แล้วทำหลัง save/cancel editor
- การลบเดี่ยวและ bulk delete ต้องใช้ confirm dialog ที่ระบุชื่อหรือจำนวน record

## Information architecture

### Desktop ตั้งแต่ 1025px

```text
┌──────────────── Header / Brand / Theme ────────────────┐
├──────────── Print Rail: health + sync state ───────────┤
├ Search ─ Filters ─ Tools ───────────── Add printer ────┤
├──────────────── Printer table ─────────────────────────┤
│ sticky header / selection / sort / status / actions    │
└──────────────── pagination / row count ────────────────┘
                                      ┌ Editor side panel ┐
                                      │ add / edit form   │
                                      └───────────────────┘
```

- ตารางเป็นพื้นที่หลัก ไม่วาง form ค้างกินพื้นที่ตลอดเวลา
- Editor เปิดเป็น side panel กว้างประมาณ 420–480px
- Toolbar และ table header sticky ภายในพื้นที่ที่เหมาะสม
- row height เป้าหมาย 56–64px เพื่ออ่านง่ายและยังแสดงข้อมูลได้มาก

### Compact ไม่เกิน 1024px

```text
จัดการ
┌ Header + compact Print Rail ┐
├ Fleet overview              ┤
├ เพิ่มเครื่องพิมพ์           ┤
└ Database/TCP tools          ┘

รายการ
┌ Search + filter chips       ┐
├ Printer card                ┤
├ Printer card                ┤
└ Pagination                  ┘

          [จัดการ] [รายการ]
```

- ใช้ printer cards ที่ออกแบบเฉพาะ compact layout ไม่ย่อตาราง desktop
- bottom navigation สูงไม่น้อยกว่า 56px และรวม safe-area inset
- filter panel เปิดแบบ sheet บนจอแคบเพื่อไม่กินพื้นที่รายการ
- หน้าโดยรวมไม่มี horizontal scroll; พื้นที่ preset อนุญาตให้เลื่อนแนวนอนได้เมื่อจำเป็น

## Visual system

### Netflix default palette

| Token | ค่า | การใช้งาน |
| --- | --- | --- |
| Canvas Ink | `#07090D` | พื้นหลังหลัก |
| Carbon Surface | `#10151D` | card/table/dialog |
| Paper White | `#F5F7FA` | ข้อความหลัก |
| Signal Red | `#E50914` | primary action/focus/accent |
| Status Mint | `#2DD4A8` | online/success |
| Warning Amber | `#F3B33D` | warning/pending |

Dark Glass ค่าเริ่มต้นใช้ opacity 88% และ blur 12px แต่พื้นผิวข้อมูลหนาแน่น เช่น table ต้องทึบกว่า card ตกแต่งเพื่อรักษาความอ่านง่าย

### Preset tokens

| Preset | Accent | Accent strong |
| --- | --- | --- |
| Mint | `#10B981` | `#059669` |
| Neon | `#6366F1` | `#4F46E5` |
| Rose | `#F43F5E` | `#E11D48` |
| Sunset | `#F97316` | `#EA580C` |
| Netflix | `#E50914` | `#B20710` |
| Luxury | `#F59E0B` | `#D97706` |

แต่ละ preset ต้องมี canvas gradient, surface tint, border, focus ring และ selection state ของตัวเอง โดยสถานะ online/offline/warning ยังคงความหมายเดิมและผ่าน contrast ทั้ง Dark/Light Glass

### Typography

- Chakra Petch: product title, section title, KPI และตัวเลขสถานะ
- IBM Plex Sans Thai: form, table, buttons, helper/error text
- system monospace: IP address, technical output และ TCP script
- type scale ต้องไม่ต่ำกว่า 14px สำหรับเนื้อหาหลักบน compact layout

### Signature element: Print Rail

Print Rail เป็นแถบข้อมูลสุขภาพ fleet ที่มีหน้าตาอ้างอิงแผงควบคุมเครื่องพิมพ์ แสดงข้อมูลจริงแทน decoration:

```text
● 5 พร้อมใช้   ● 3 ต้องตรวจ   8 เครื่องทั้งหมด   Sync 14:30
━━━━━━━━━━━━━━━━ scanning line ระหว่าง sync ━━━━━━━━━━━━━━━
```

เพื่อเลี่ยงภาพจำ dashboard dark/glow ทั่วไป จะจำกัด glow เฉพาะ focus/active state ใช้เส้นคล้ายขอบกระดาษและระดับหมึกเป็นโครงสร้างข้อมูล และไม่สร้าง KPI cards ซ้ำซ้อน

## Theme Studio behavior

- ค่าเริ่มต้นครั้งแรก: Netflix, dark, 88, 12
- preset, surface, opacity และ blur preview ทันที
- บันทึกค่าที่ normalize แล้วใน `printerThemeSettings`
- ทุกครั้งที่เลือก preset Netflix ให้ตั้ง surface เป็น Dark Glass จากนั้นผู้ใช้ยังสลับเป็น Light Glass ได้
- custom image ใช้เฉพาะ Theme Studio preview และ FleetOverview hero card ห้ามใช้กับ `body`, header, table หรือ dialog
- custom image ใช้ object URL เฉพาะ session และ revoke เมื่อเปลี่ยนหรือลบ
- reset คืน Netflix + Dark Glass + 88% + 12px
- Theme Studio ไม่เรียก API และไม่แก้ printer cache

## Interaction และ copy

- ปุ่มใช้คำกริยาที่อธิบายผล เช่น `เพิ่มเครื่องพิมพ์`, `บันทึกการเปลี่ยนแปลง`, `ซิงก์กับชีต`, `ลองอีกครั้ง`
- คำเดิมต้องใช้สม่ำเสมอใน button, toast และ status
- Add/edit ใช้ editor เดียวกันและเปลี่ยน title/action ตาม mode
- Escape ปิด dialog/drawer เมื่อไม่มี unsaved draft; หากมี draft ให้ยืนยันก่อนปิด
- empty state อธิบายสิ่งที่ทำต่อได้ เช่น ล้างตัวกรองหรือเพิ่มเครื่องพิมพ์
- action สำเร็จใช้ toast แบบไม่ขโมย focus; error สำคัญแสดงทั้ง inline และ `aria-live`

## Error handling

| สถานการณ์ | พฤติกรรม UI |
| --- | --- |
| โหลด server ไม่ได้แต่มี cache | แสดง cache, status `ข้อมูลสำรองในเครื่อง`, ปุ่มลองอีกครั้ง |
| โหลดไม่ได้และไม่มี cache | empty error state พร้อม retry; ไม่แสดงข้อมูลปลอม |
| save/sync ไม่สำเร็จ | คง local edit, status `บันทึกไม่สำเร็จ`, retry action |
| payload ไม่ถูกต้อง | ไม่ส่ง request และชี้ field ที่ต้องแก้ |
| API ส่งข้อมูลรูปแบบผิด | ปฏิเสธ snapshot ใหม่และรักษาข้อมูลเดิม |
| theme storage เสีย | fallback ค่า default โดยไม่ทำให้แอปล่ม |
| custom image ใช้ไม่ได้ | ล้าง object URL และกลับ preset ล่าสุด |

UI ห้ามแสดง raw stack trace, upstream URL, secret หรือข้อความภายในที่ไม่ช่วยให้ผู้ใช้แก้ปัญหา

## PWA และ offline

- cache เฉพาะ app shell, font และ icon ที่ build แล้ว
- `/api/printers` ใช้ network-only ใน service worker เพื่อไม่ cache write/read response ที่อาจ stale
- offline data มาจาก IndexedDB snapshot ไม่ใช่ service worker API cache
- ใช้ manifest และ icon เดิมที่ผ่านการตรวจแล้ว โดยปรับเฉพาะ path/build integration ที่จำเป็น
- แสดงสถานะ update available และให้ผู้ใช้กด reload หลังไม่มี unsaved editor draft

## Accessibility และ motion

- semantic landmarks: header, main, nav, section และ dialog/drawer ที่ประกาศชื่อชัดเจน
- input ทุกตัวมี label; icon-only button มี accessible name
- focus-visible contrast ชัดทั้ง 6 presets และ Dark/Light Glass
- ใช้ `aria-pressed` สำหรับ theme preset/surface และ `aria-live` สำหรับ sync/toast
- ไม่ใช้สีเพียงอย่างเดียวบอกสถานะ; ทุก badge มีข้อความหรือ icon ที่มีความหมาย
- touch target ขั้นต่ำ 44×44px
- `prefers-reduced-motion` ปิด scanning line และลด transition เหลือเกือบทันที
- รองรับ keyboard flow ของ table selection, filter, dialog, drawer และ bottom navigation

## Responsive contracts

ต้องตรวจอย่างน้อย viewport ต่อไปนี้:

- 360×800
- 390×844
- 430×932
- 768×1024
- 820×1180
- 1024×768
- 1025×768
- 1280×800
- 1440×900

ทุก viewport ต้องไม่มี horizontal overflow, control ที่มองเห็นต้องสูงอย่างน้อย 44px, bottom navigation ไม่บังเนื้อหา และ editor/theme dialog อยู่ภายใน viewport

## Test strategy

### Unit

- printer normalizer และ strict payload builder
- filter, sort, pagination และ fleet statistics
- theme normalization/clamp/default/reset
- legacy localStorage → IndexedDB migration
- API error mapping และ retry state

### Component

- PrinterEditor validation และ dirty-close protection
- desktop table กับ compact cards ใช้ action/selection ชุดเดียวกัน
- bulk delete confirm แสดงจำนวนที่ถูกต้อง
- Theme Studio อัปเดต CSS tokens, persistence และ custom image lifecycle
- Print Rail แสดง sync/local/error states และ reduced motion
- mobile navigation มีเพียง 2 แท็บ

### Contract

- `api/printers.js`, `Code.gs`, sheet schema และ security tests เดิมต้องยังผ่าน
- frontend API contract ปรับจาก regex ใน `Index.html` ไปตรวจ typed API adapter/payload
- ไม่มี MAC Address, Apps Script URL หรือ secret ใน client bundle

### E2E/visual

- ใช้ local fixture server/mock API เท่านั้น
- ตรวจ startup, add, edit, delete, bulk delete, filter, CSV, TCP import และ retry
- ตรวจ 6 presets × Dark/Light อย่างน้อยใน smoke matrix
- screenshot desktop, tablet และ mobile สำหรับ Netflix default รวม Theme Studio/editor states
- ตรวจ keyboard focus, no overflow, touch target และ reduced motion

## Migration และ blast radius

### ไฟล์ที่จะถูกแทนหรือเพิ่ม

- แทน `Index.html` monolith ด้วย Vite `index.html` และ `src/`
- เพิ่ม Vite/TypeScript/test/PWA configuration และ dependencies ที่จำเป็น
- ปรับ `package.json`, lockfile, `vercel.json`, manifest/service-worker integration ตาม build output
- ปรับ frontend-focused tests ให้ตรวจ component/build ใหม่

### ไฟล์ที่คง contract เดิม

- `api/printers.js`
- `Code.gs`
- Google Sheet headers/schema
- PWA icon source assets
- environment variables และ secret handling

### ความเสี่ยงและวิธีลด

| ความเสี่ยง | วิธีลด |
| --- | --- |
| frontend ใหม่ส่ง payload ไม่ตรง proxy | typed payload builder + contract test กับ allowlist เดิม |
| cache migration ทำข้อมูล local หาย | copy/validate ก่อน mark migration complete และไม่ลบ legacy key จนเขียน IndexedDB สำเร็จ |
| PWA เสิร์ฟ bundle เก่า | generated service worker, update prompt และ build-version test |
| theme บาง preset contrast ต่ำ | token matrix test + visual QA ทั้ง Dark/Light |
| compact UI ข้อมูลแน่นเกินไป | card-specific layout, filter sheet และ viewport screenshots |
| rewrite กระทบ TCP/CSV | แยก pure utility tests และ fixture files ก่อนย้าย UI |

## เกณฑ์ยอมรับ

- หน้าแรกเปิดด้วย Netflix + Dark Glass + 88% + 12px
- ทั้ง 6 presets เปลี่ยนภาพรวมของแอปอย่างสม่ำเสมอและบันทึกค่าที่ validate แล้ว
- Desktop ใช้ table-centric command center และ form เปิดเป็น side panel
- Viewport ไม่เกิน 1024px ใช้ navigation 2 แท็บและ printer cards
- CRUD, bulk delete, filters, sorting, pagination, CSV, TCP workflow และ Google Sheet sync ใช้งานได้ครบ
- การโหลด/sync ล้มเหลวไม่ทำให้ local edit หรือ snapshot หาย
- custom image ไม่ถูกเก็บถาวรและไม่ถูกใช้เป็น body background
- ไม่มี MAC Address, secret หรือ Apps Script URL ใน client
- build, type-check, lint, unit/component/contract tests และ responsive Playwright checks ผ่านจริง
- ตรวจภาพจริงอย่างน้อย desktop, tablet และ mobile โดยไม่มี overflow, contrast หรือ touch-target defect ที่ทราบอยู่
