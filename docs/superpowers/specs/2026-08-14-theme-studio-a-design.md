# สเป็กการปรับธีม Theme Studio — แนวทาง A

## สถานะ

- แนวทางที่ผู้ใช้เลือก: A — Theme Studio เต็มระบบ
- ขั้นตอนปัจจุบัน: ล็อกสเปกเพื่อรีวิวก่อนเริ่มแก้ `Index.html`
- ขอบเขตการแก้ไขครั้งนี้: หน้าตาและ state ของธีมฝั่ง client เท่านั้น

## เป้าหมาย

ปรับ Printer Management Pro ให้เป็นแดชบอร์ดจัดการเครื่องพิมพ์แบบ Dark Glass ที่ปรับธีมได้จากหน้าใช้งาน โดยยังคง workflow เดิมของการเพิ่มเครื่องพิมพ์ การอ่านข้อมูลล่าสุดจากชีต การกรองรายการ และเมนูสองแท็บบนไอแพด/มือถือ

## แหล่งอ้างอิง

- `C:\Users\Theboy-AsusTUF\OneDrive\#ProjectWebApp\CARD-THEME-CONFIG.md` เป็นแม่แบบด้าน preset, glass controls, local persistence และ responsive card behavior
- `ui-ux-pro-max` เป็นแนวทางด้านลำดับชั้นข้อมูล, contrast, focus state, touch target และ responsive QA
- `Index.html` และ asset watermark/icon เดิมเป็นฐานของโครงสร้างและภาพลักษณ์แอป

## แนวทางภาพรวม

### โครงสร้างหน้าหลัก

- Header เป็นจุดนำสายตา: ชื่อ `Printer Management Pro`, subtitle `Enterprise Edition`, watermark เครื่องพิมพ์โปร่งใส และสถานะ sync ล่าสุด
- ใต้ header แบ่งเป็นการ์ดหลักแบบ dashboard: เพิ่มเครื่องพิมพ์, Theme Studio, ภาพรวมระบบ และรายการเครื่องพิมพ์
- Theme Studio เปิดใช้งานได้จากปุ่ม/การ์ดเครื่องมือที่มีชื่อชัดเจน ไม่ซ่อนการตั้งค่าไว้ในเมนูที่ต้องเดา
- ยังคงการจัดกลุ่มเมนูหลัก 2 แท็บ และไม่ทำให้เกิดการเลื่อนแนวนอนบน viewport ที่รองรับ

### ระบบสีและพื้นผิว

ค่าเริ่มต้นของแนวทาง A:

- Preset: `Netflix`
- Surface: `Dark Glass`
- Opacity: `88%`
- Blur: `12px`

Preset ที่ผู้ใช้เลือกได้:

| Preset | สีหลัก | การใช้งาน |
| --- | --- | --- |
| Mint | เขียวมิ้นต์ | สถานะสำเร็จและงานทั่วไป |
| Neon | เขียว/ฟ้าเรือง | งานที่ต้องการความเด่น |
| Rose | ชมพู/แดงอ่อน | หน้าสถานะหรือแจ้งเตือน |
| Sunset | ส้ม/เหลือง | งานที่ต้องการความอบอุ่น |
| Netflix | แดงเข้ม/ทอง | ค่าเริ่มต้นของแอป |
| Luxury | ทอง/หมึกเข้ม | มุมมองผู้ดูแลระบบ |

- `Dark Glass` ใช้พื้นหลังเข้ม โปร่งแสง และขอบบางที่ยังคง contrast ของข้อความ
- `Light Glass` ใช้พื้นหลังสว่างที่ยังรักษาสี accent ของ preset เดิม
- ภาพ custom ใช้เฉพาะภายในการ์ด ไม่เปลี่ยนพื้นหลังทั้งหน้า และไม่บันทึกไฟล์ภาพลง `localStorage`
- ปุ่มสถานะและปุ่ม destructive ต้องยังแยกสีได้ชัด และไม่ใช้สีอย่างเดียวเป็นตัวบอกสถานะ

## พฤติกรรม Theme Studio

1. ผู้ใช้เลือก preset จาก swatch ที่มีชื่อ/คำอธิบายและ `aria-pressed`
2. ผู้ใช้สลับ `Dark Glass` / `Light Glass` ผ่าน segmented toggle ที่มีปุ่ม `Dark` และ `Light` ชัดเจนใน Theme Studio พร้อม `aria-pressed` และ focus-visible
3. ผู้ใช้ปรับ opacity ในช่วง `40–100` และ blur ในช่วง `0–30px`
4. ทุกการเปลี่ยนแปลงอัปเดต preview ทันทีโดยไม่ reload หน้า
5. ปุ่ม `บันทึก` เขียนค่าที่ผ่านการ clamp และ validate ลง `localStorage`
6. เมื่อเปิดหน้าใหม่ อ่านค่าที่บันทึกไว้ ถ้าข้อมูลเสียหายให้กลับค่า default โดยไม่ทำให้หน้าใช้งานไม่ได้
7. ปุ่ม `คืนค่าเริ่มต้น` ล้างเฉพาะค่าธีมและแสดงผล default ทันที
8. การตั้งค่าต้องไม่เปลี่ยนข้อมูลเครื่องพิมพ์หรือ trigger การเขียนชีต

## Responsive และ UX

- Breakpoint หลักคงที่ที่ `1025px`: desktop ใช้ multi-column dashboard, ต่ำกว่านั้นใช้การ์ดซ้อนแนวตั้ง
- ไอแพด/มือถือ: การ์ด Theme Studio, form, overview และรายการต้องเต็มความกว้างที่เหลืออย่างพอดี ไม่เบียดกัน
- เมนูหลักยังมี 2 แท็บเต็มความกว้างด้านล่าง และต้องไม่ทำให้เกิด scroll แนวนอน
- input และปุ่มสำคัญมีพื้นที่กดอย่างน้อย `44px` พร้อม safe-area inset
- การ์ดรายการเครื่องพิมพ์ต้องตัดข้อความได้อย่างปลอดภัย ไม่ดันปุ่มแก้ไข/ลบออกนอกขอบ
- รองรับ swipe แนวนอนเฉพาะพื้นที่ที่ผู้ใช้ตั้งใจเลื่อน เช่น แถบ preset; หน้าโดยรวมยังล็อก overflow แนวนอน
- `prefers-reduced-motion` ลด transition/animation เหลือการเปลี่ยนสีหรือ opacity ที่จำเป็น
- focus-visible ต้องมองเห็นชัดบนทั้ง Dark และ Light Glass

## ขอบเขตข้อมูลและ backend

- ไม่เปลี่ยน schema ของชีตหรือ Apps Script ในงาน redesign นี้
- ไม่เพิ่มการอ่าน/เขียนข้อมูลนอก workflow เดิม
- คงการอ่านข้อมูลล่าสุดจากชีตอัตโนมัติ และคง fallback local ตามสัญญาเดิม
- ปุ่ม Backup/Restore ไม่อยู่ใน layout ใหม่ เพราะข้อมูลถูกดึงจากชีตแล้ว; ไม่สร้างปุ่มทดแทนที่ทำงานซ้ำ
- ไม่คืนช่อง Mac Address กลับมาในฟอร์ม

## โครงสร้าง state ที่เสนอ

ใช้ state object ฝั่ง client แยกจาก state รายการเครื่องพิมพ์:

```text
themeState
├─ preset: mint | neon | rose | sunset | netflix | luxury
├─ surface: dark-glass | light-glass
├─ opacity: 40..100
├─ blur: 0..30
└─ customImage: null | transient object URL
```

- ค่าใน `themeState` เป็นแหล่งเดียวสำหรับ CSS custom properties ของธีม
- localStorage เก็บเฉพาะ primitive ที่ validate แล้ว; ไม่เก็บ object URL หรือไฟล์ภาพ
- การเปลี่ยน route/tab ไม่ควร reset `themeState` ระหว่าง session

## Seams สำหรับ TDD (เสนอให้ยืนยันก่อนเริ่มเขียน test)

1. `Theme Studio` เปลี่ยน preset แล้วสีของ card/header เปลี่ยนทันที
2. การปรับ opacity/blur clamp อยู่ในช่วงที่กำหนดและสะท้อนใน preview
3. reload/เปิดหน้าใหม่คืนค่าธีมที่บันทึกไว้ และข้อมูลเสียหาย fallback เป็น default
4. reset theme คืนค่า `Netflix + Dark Glass + 88% + 12px`
5. การเปลี่ยนธีมไม่เรียก API และไม่แก้ข้อมูลเครื่องพิมพ์
6. viewport 375, 430, 768, 820, 1024, 1025 และ desktop ไม่เกิด horizontal overflow และเมนูสองแท็บยังใช้งานได้

## เกณฑ์ยอมรับ

- ผู้ใช้เห็น Theme Studio และปรับ preset, surface, opacity, blur ได้โดยไม่ reload
- ปุ่ม Dark/Light เปลี่ยนพื้นผิวและสีข้อความของการ์ดทันที โดยยังอ่านได้ตามเกณฑ์ contrast
- ค่า default และ persistence ตรงกับแม่แบบ `CARD-THEME-CONFIG.md`
- UI ใช้งานได้บน desktop, iPad และมือถือโดยไม่มีการ์ดชน/ล้น/ปุ่มถูกตัด
- สถานะ sync, header watermark และข้อมูลรายการเดิมยังอยู่ครบ
- ไม่มีการเรียก backend จากการปรับธีม และไม่มี secret/endpoint ใหม่ใน client
- ผ่าน contract/responsive tests ที่เกี่ยวข้องและตรวจภาพจริงอย่างน้อย desktop + iPad + มือถือ

## นอกขอบเขต

- เปลี่ยน backend, schema ชีต, authentication หรือ deployment
- สร้างระบบ upload รูปภาพถาวรหรือ CDN สำหรับ custom image
- เพิ่ม preset นอกเหนือจาก 6 รายการโดยไม่ทำ design review ใหม่
- เปลี่ยนตรรกะ sync หรือแก้ข้อมูลจริงในชีตระหว่างทดสอบ
