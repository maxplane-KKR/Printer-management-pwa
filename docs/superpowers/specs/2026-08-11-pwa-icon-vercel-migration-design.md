# สเป็กไอคอน PWA และการย้ายระบบไป Vercel

## เป้าหมาย

ย้ายหน้า Printer Management Pro จาก Google Apps Script HTML Service ไปโฮสต์บน Vercel ผ่าน GitHub repository `maxplane-KKR/Printer-management-pwa` พร้อมเพิ่ม PWA icon ที่สื่อถึงระบบจัดการเครื่องพิมพ์และรองรับเบราว์เซอร์หลักบน Android, iOS, iPadOS, macOS, Windows และ Linux โดยคง Google Apps Script กับ Google Sheet เป็น backend เดิม

## รูปแบบไอคอนที่อนุมัติ

- ใช้แนวทาง A: เครื่องพิมพ์เชื่อมต่อโหนดเครือข่ายแบบ Clay UI
- สีหลักใช้ชุดเดียวกับหน้าแอป:
  - เหลือง `#F4C95D`
  - ฟ้า `#A9D8F5`
  - หมึกเข้ม `#20252B`
  - Coral `#F4897D`
  - ขาวอุ่น `#FFFDF7`
- ไม่มีข้อความ อักษรย่อ หรือตราสินค้าภายนอก
- วางรายละเอียดสำคัญภายในพื้นที่กลาง 66% เพื่อไม่ถูกตัดเมื่อระบบปฏิบัติการครอบไอคอนเป็นวงกลม สี่เหลี่ยมมุมมน หรือรูปทรงอื่น
- สร้างเวอร์ชันรายละเอียดเต็มสำหรับขนาดใหญ่ และเวอร์ชันลดรายละเอียดสำหรับ favicon ขนาดเล็ก

## ชุดไฟล์ไอคอน

- `assets/icons/icon-192.png` และ `icon-512.png` สำหรับ Web App Manifest
- `assets/icons/icon-maskable-192.png` และ `icon-maskable-512.png` สำหรับ Android maskable
- `assets/icons/apple-touch-icon.png` ขนาด 180×180
- `assets/icons/favicon-16x16.png` และ `favicon-32x32.png`
- `assets/icons/favicon.ico` แบบหลายขนาดสำหรับเบราว์เซอร์เดสก์ท็อป
- `assets/icons/mstile-150x150.png` สำหรับ Windows tile
- `assets/icons/safari-pinned-tab.svg` แบบสีเดียวสำหรับ Safari pinned tab
- เก็บภาพต้นฉบับขนาด 1024×1024 เพื่อใช้แตกไฟล์ใหม่โดยไม่ลดคุณภาพซ้ำ

## สถาปัตยกรรมระบบ

```text
ผู้ใช้และ PWA บน Vercel
          |
          | GET/POST /api/printers
          v
Vercel Serverless Function
          |
          | HTTPS พร้อม Shared Secret ฝั่งเซิร์ฟเวอร์
          v
Google Apps Script Web App
          |
          v
Google Sheet เดิม
```

### Frontend

- ใช้หน้า `Index.html` เดิมและรักษา responsive breakpoint 1025px รวมถึงสองแท็บบนมือถือ/ไอแพด
- เปลี่ยนการอ่านและบันทึกข้อมูลให้เรียก same-origin endpoint `/api/printers`
- โหลดข้อมูลล่าสุดจากชีตเมื่อเริ่มหน้า และคง local storage เป็นข้อมูลสำรองเมื่อ backend ใช้งานไม่ได้
- เพิ่ม `manifest.webmanifest`, `service-worker.js`, theme color และลิงก์ไอคอนสำหรับแต่ละระบบปฏิบัติการ
- Service Worker cache เฉพาะ app shell และ static assets ห้าม cache คำขอแก้ไขข้อมูลหรือ response ของ `/api/printers`

### Vercel API

- สร้าง `api/printers.js` เป็น proxy ระหว่าง browser กับ Apps Script
- รองรับเฉพาะ `GET` สำหรับอ่านรายการ และ `POST` สำหรับบันทึกรายการ
- ตรวจชนิดข้อมูล จำกัดขนาด request และส่ง status code ที่ชัดเจน
- อ่าน `APPS_SCRIPT_URL` และ `API_SHARED_SECRET` จาก Vercel Environment Variables เท่านั้น
- ห้ามส่ง URL ของ Apps Script หรือ Shared Secret กลับไปยัง client

### Apps Script Backend

- คง `Code.gs` เป็นตัวเชื่อม Google Sheet
- เพิ่ม action สำหรับอ่านข้อมูลผ่าน `doPost` เพื่อให้ Shared Secret อยู่ใน request body และไม่ปรากฏใน query string
- ตรวจ Shared Secret จาก Script Property ชื่อ `API_SHARED_SECRET`
- คง Script Property `SPREADSHEET_ID` สำหรับ standalone script
- ใช้ Script Lock และ schema เดิมเพื่อป้องกันการเขียนชนกัน

## Repository และการ Deploy

- GitHub repository เป้าหมายคือ `maxplane-KKR/Printer-management-pwa` และใช้ branch `main`
- Repository เป็น Public แต่ไม่มี secret หรือ Apps Script endpoint อยู่ใน source
- สร้าง Vercel project ภายใต้ทีม `maxplane` และเชื่อมกับ repository นี้
- Push ไป `main` แล้วให้ Vercel สร้าง production deployment ผ่าน Git integration
- ตั้งค่า `APPS_SCRIPT_URL` และ `API_SHARED_SECRET` ใน Vercel Production/Preview environment
- ตั้งค่า Shared Secret ค่าเดียวกันใน Apps Script Script Properties

## การจัดการข้อผิดพลาด

- หากอ่านชีตไม่ได้ ให้แสดงข้อมูลสำรองจาก local storage พร้อมสถานะว่าเป็นข้อมูล local
- หากบันทึกไม่สำเร็จ ห้ามแสดงว่า sync แล้ว และต้องรักษาข้อมูลใน browser ไว้
- Vercel proxy ต้องแปลงข้อผิดพลาด backend เป็น JSON รูปแบบคงที่โดยไม่เปิดเผย secret หรือรายละเอียดภายใน
- Service Worker ต้องไม่ขัดขวางการโหลดหน้าเวอร์ชันใหม่ และต้องล้าง cache เก่าเมื่อชื่อ cache เปลี่ยน

## การตรวจสอบ

- ตรวจขนาด สี alpha channel และ safe zone ของไอคอนทุกไฟล์
- ตรวจ manifest ด้วยไอคอน `any` และ `maskable`
- ตรวจ favicon, Apple touch icon, Windows tile และ Safari pinned tab ว่าอ้างอิงไฟล์ที่มีอยู่จริง
- รันทดสอบ responsive เดิมที่ 320×720, 430×720, 820×1180, 812×375, 1024×768 และ breakpoint 1025px
- เพิ่ม contract test สำหรับ manifest, service worker, API proxy และการไม่ฝัง secret ใน client
- ตรวจ preview deployment ก่อน production
- หลัง production ให้ทดสอบหน้าเว็บ, API read/write, การโหลดข้อมูลล่าสุด และตรวจ runtime/build logs

## ขอบเขต

- งานนี้ไม่ย้ายข้อมูลออกจาก Google Sheet
- ไม่เพิ่มฐานข้อมูลใหม่
- ไม่เปลี่ยน schema เครื่องพิมพ์นอกเหนือจากสิ่งจำเป็นต่อ API
- ไม่แก้ค่าข้อมูลจริงในชีตระหว่างทดสอบ local; การทดสอบเขียนจริงทำเฉพาะเมื่อผู้ใช้อนุมัติ production gate
- ไม่บันทึก token, Shared Secret หรือ URL backend ลง Git
