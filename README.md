# TikLive Gift Stage

เว็บ Overlay ภาษา TypeScript สำหรับ TikTok LIVE Studio ใช้ Three.js วางตัวละคร 3D บนภาพฉากหลังที่ผู้ใช้ให้มา TikTok LIVE Connector รับ Gift แล้วส่ง event ผ่าน WebSocket เพื่อเพิ่มนักเต้น คะแนน เอฟเฟกต์ และรายชื่อผู้ส่ง

## เริ่มใช้งาน

ต้องใช้ Node.js 20 ขึ้นไป

```powershell
npm install
npm run dev
```

เปิด `http://127.0.0.1:3000` แล้วใส่ TikTok username หรือ URL ของ LIVE จากนั้นกด **เชื่อมต่อ** ทดสอบได้ด้วยปุ่ม **ส่ง Gift ทดสอบ**

## เพิ่มใน TikTok LIVE Studio

1. คัดลอก URL ในส่วน **URL สำหรับเพิ่มเป็น Link source** บนหน้า Control
2. ใน LIVE Studio เลือก **Add source > Link**
3. วาง URL แล้วกด **Add source**
4. ปรับขนาด/ตำแหน่ง Overlay ตามต้องการ

URL ที่ได้เป็น local URL สำหรับใช้บนคอมพิวเตอร์เครื่องเดียวกับที่รันเซิร์ฟเวอร์ โดยต้องเปิด `npm run dev` และหน้าเว็บเซิร์ฟเวอร์ค้างไว้ระหว่างไลฟ์

## Deploy บน Render

ไฟล์ [render.yaml](./render.yaml) เตรียม Web Service สำหรับ Node.js ใน Singapore พร้อม build, health check และสร้าง `OVERLAY_KEY` / `CONTROL_PASSWORD` ให้อัตโนมัติ

1. Push โปรเจกต์ขึ้น GitHub
2. ใน Render เลือก **New > Blueprint** แล้วเชื่อม repository นี้
3. ตรวจค่าใน Blueprint แล้วสร้าง service
4. เปิด URL ของ service และลงชื่อเข้า control panel ด้วย username `admin` และค่า `CONTROL_PASSWORD` จาก Environment ใน Render
5. คัดลอก Overlay URL จากหน้า control ไปใส่ใน TikTok LIVE Studio

หน้า control และ API ใช้ HTTP Basic Auth; ค่า `CONTROL_PASSWORD` ถูกสร้างเป็น secret โดย Render ส่วน Overlay ใช้ `OVERLAY_KEY` แยกต่างหาก
Blueprint ตั้งเป็น Free เพื่อไม่เริ่มค่าใช้จ่ายโดยไม่ตั้งใจ; Free service อาจ sleep เมื่อไม่มี traffic และทำให้การเชื่อมต่อ LIVE หลุดได้ หากใช้ไลฟ์ต่อเนื่องควรเลือกแผนที่ไม่ sleep ใน Render

## Gift events

- กุหลาบ/ดอกไม้: เพิ่มนักเต้นและแสดงเอฟเฟกต์ดอกกุหลาบ
- Gift มูลค่า 100 เพชรขึ้นไป: แสดงเอฟเฟกต์ MEGA GIFT
- Gift อื่น ๆ: เพิ่มคะแนนและแสดงเอฟเฟกต์ทั่วไป
- ของขวัญแบบ streak จะนับเมื่อ streak จบ เพื่อลดการนับซ้ำ
- ตัวละครนักเต้นสไตล์ 3D สร้างจาก geometry ของ Three.js พร้อมท่าเต้น procedural และชุดสีที่เข้ากับเวที

แพ็กเกจ `tiktok-live-connector` เป็นไลบรารีไม่เป็นทางการที่อ่าน TikTok LIVE Webcast และใช้ผู้ให้บริการเซ็น WebSocket ภายนอกตามค่าเริ่มต้น โปรโตคอลอาจเปลี่ยนได้ ตรวจสอบเงื่อนไขการใช้งาน/ไลเซนส์ AGPL-3.0 ของแพ็กเกจก่อนนำไปเผยแพร่หรือใช้งานเชิงพาณิชย์

## Build สำหรับรันแบบ production

```powershell
npm run build
npm start
```

จากนั้นใช้ URL ที่แสดงใน terminal หรือหน้า Control เพิ่มเป็น Link source เช่นเดียวกัน
