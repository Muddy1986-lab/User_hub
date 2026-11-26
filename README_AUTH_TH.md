# NE1 อีสานทีม — ระบบป้องกันด้วย Username / Password

ชุดนี้ย้ายการให้บริการจาก GitHub Pages แบบสาธารณะ ไปอยู่บน Cloudflare Workers + D1 เพื่อให้ Worker ตรวจสอบ session ก่อนส่งไฟล์หน้าเว็บทุกครั้ง หน้าเว็บหลักอยู่ใน `public/` เท่านั้น และต้องผ่านการตรวจสอบบัญชีที่อนุมัติแล้วก่อน

## สำคัญมาก: ข้อจำกัดของ GitHub Pages

**อย่าเผยแพร่โฟลเดอร์ `public/` หรือไฟล์เว็บไซต์เดิมผ่าน GitHub Pages ต่อไป** เพราะ GitHub Pages เป็นโฮสต์สาธารณะและไม่สามารถบังคับให้ทุก request ผ่านระบบ User/Password ใน Worker ได้ ให้หยุด GitHub Pages deployment เดิมก่อน แล้วใช้ URL `*.workers.dev` ที่ Cloudflare ออกให้ หรือผูกโดเมนของทีมกับ Worker แทน

ลิงก์ Google Drive / Google Sheets / Forms ภายนอกที่อยู่ในหน้าเว็บยังมีสิทธิ์การแชร์ของตัวเอง ระบบ Login นี้ไม่สามารถปิดกั้นไฟล์ Google ที่ตั้งค่าแชร์เป็น “ทุกคนที่มีลิงก์” ได้ ต้องปรับสิทธิ์แชร์ไฟล์เหล่านั้นใน Google Drive แยกต่างหาก

## ความสามารถ

- หน้า Login เป็นประตูทางเข้าก่อนหน้าเว็บหลัก
- สมัครสมาชิกได้เมื่อ Super Admin เปิดรับสมัคร; บัญชีใหม่มีสถานะ `pending`
- Super Admin อนุมัติ ระงับ หรือลบบัญชีได้จาก `/admin`
- Super Admin สร้างบัญชีให้สมาชิกได้
- เปิด/ปิดการสมัครสมาชิกเองได้
- Password ถูกแฮชด้วย PBKDF2-HMAC-SHA256 (310,000 iterations) พร้อม salt เฉพาะบัญชี
- Session ใช้ cookie `HttpOnly`, `Secure`, `SameSite=Strict` และหมดอายุใน 12 ชั่วโมง
- API ตรวจสิทธิ์ฝั่ง Worker; ไม่เชื่อถือการซ่อนหน้าเว็บด้วย JavaScript

## 1) เตรียม Cloudflare

1. สร้าง/เข้าสู่ระบบ Cloudflare account
2. ติดตั้ง Node.js และ Wrangler CLI บนคอมพิวเตอร์
3. เปิด Terminal ในโฟลเดอร์โปรเจกต์นี้
4. สร้างฐานข้อมูล:

```bash
npx wrangler login
npx wrangler d1 create ne1-members
```

5. นำ `database_id` ที่ Cloudflare แสดงมาแทนค่า `REPLACE_WITH_YOUR_D1_DATABASE_ID` ใน `wrangler.toml`
6. สร้างตารางในฐานข้อมูล:

```bash
npx wrangler d1 migrations apply ne1-members --remote
```

## 2) ตั้งค่า Super Admin คนแรก

ตั้ง secret ที่ใช้เปิดการสร้างผู้ดูแลคนแรก (ห้ามใส่ secret นี้ลงในไฟล์หรือ GitHub):

```bash
npx wrangler secret put BOOTSTRAP_KEY
```

ใส่ค่า secret ที่คาดเดายากและเก็บไว้เป็นความลับ จากนั้น Deploy:

```bash
npx wrangler deploy
```

Cloudflare จะแสดง URL ของ Worker เช่น `https://ne1-isan-team-private.<ชื่อบัญชี>.workers.dev`

เรียก API เพื่อตั้ง Super Admin คนแรก โดยแทน URL, SETUP_KEY, USERNAME และ PASSWORD ด้วยค่าของคุณเอง (Password อย่างน้อย 12 ตัวอักษร):

```bash
curl -X POST "https://YOUR-WORKER.workers.dev/api/setup" \
  -H "content-type: application/json" \
  -d '{"key":"SETUP_KEY","username":"USERNAME","password":"A-Long-Unique-Password-Here","full_name":"NE1 Super Admin"}'
```

เมื่อได้ข้อความสร้าง Super Admin สำเร็จ ให้ลบ secret สำหรับ bootstrap ทันที:

```bash
npx wrangler secret delete BOOTSTRAP_KEY
```

API setup จะสร้างผู้ดูแลได้เฉพาะเมื่อยังไม่มี admin อยู่แล้วเท่านั้น

## 3) ใช้งาน

- เปิด URL Worker แล้วเข้าสู่ระบบด้วยบัญชี Super Admin
- เปิด `/admin` เพื่อจัดการสมาชิก
- เปิด “รับสมัครสมาชิก” หากต้องการให้พนักงานสมัครเอง
- ผู้สมัครใหม่จะยังเข้าเว็บไม่ได้จนกว่าจะได้รับอนุมัติ
- หากปิดรับสมัคร Super Admin ยังสร้างบัญชีให้พนักงานได้จากหน้า `/admin`

## 4) เผยแพร่ URL เดิม

ถ้าต้องการใช้โดเมนของทีมเอง ให้เพิ่มโดเมนนั้นใน Cloudflare และกำหนด Custom Domain ให้ Worker ตามขั้นตอนใน Cloudflare Dashboard จากนั้นปิด GitHub Pages เดิม/ยกเลิกการเผยแพร่เนื้อหาสาธารณะ อย่าให้มี URL เก่าที่เปิดหน้าเว็บได้โดยไม่ผ่าน Worker

## 5) รายการตรวจสอบความปลอดภัยก่อนใช้งานจริง

- [ ] ปิด GitHub Pages เดิม และทดสอบว่า URL `github.io` เดิมไม่แสดงเนื้อหาอีก
- [ ] สร้าง D1 และ apply migration บน remote สำเร็จ
- [ ] ตั้ง BOOTSTRAP_KEY และสร้าง Super Admin คนแรก
- [ ] ลบ BOOTSTRAP_KEY หลังสร้าง admin สำเร็จ
- [ ] ทดสอบบัญชี pending ว่าเข้าเว็บหลักไม่ได้
- [ ] ทดสอบบัญชี disabled ว่า session เดิมถูกตัดและเข้าเว็บไม่ได้
- [ ] ตรวจสิทธิ์แชร์ของ Google Drive/Sheets ทุกไฟล์ที่เชื่อมอยู่
- [ ] เปิดใช้ Cloudflare rate limiting / WAF สำหรับ `/api/login` และ `/api/setup`
- [ ] เก็บข้อมูลสำรอง D1 อย่างสม่ำเสมอ

## ข้อจำกัดและหมายเหตุ

- ไฟล์นี้เป็นชุด source สำหรับ deploy; ไม่ได้เชื่อม Cloudflare account หรือ deploy ให้โดยอัตโนมัติ
- URL `github.io` เดิมไม่สามารถถูกป้องกันย้อนหลังด้วยการเพิ่ม Worker ไว้คนละโดเมนได้ ต้องหยุดเผยแพร่ GitHub Pages หรือเปลี่ยนมาใช้ Custom Domain ที่ชี้เข้า Worker
- การป้องกันหน้า Portal ไม่ได้เปลี่ยนสิทธิ์ของเอกสารปลายทางภายนอก เช่น Google Drive
- ระบบนี้ยังไม่มีฟังก์ชัน “ลืมรหัสผ่านด้วยอีเมล”; ผู้ดูแลต้องจัดการการรีเซ็ตผ่านขั้นตอนที่ปลอดภัยในรุ่นถัดไป
