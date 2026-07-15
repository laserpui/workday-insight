# นำ Workday Insight ขึ้น GitHub และใช้งานจริง

## 1) Push repository

```bash
git init
git add .
git commit -m "Initial Workday Insight dashboard"
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPOSITORY>.git
git push -u origin main
```

## 2) เชื่อม Google Apps Script

ติดตั้ง Node.js และ Google Apps Script CLI:

```bash
npm install -g @google/clasp
clasp login
```

1. สร้าง Google Sheet ใหม่
2. เปิด **Extensions → Apps Script** แล้วคัดลอก Script ID จาก **Project Settings**
3. เปิด terminal ที่ clone repository แล้วรัน:

```bash
clasp clone <SCRIPT_ID>
clasp push
```

4. รัน `setupDatabase` หนึ่งครั้งผ่าน Apps Script editor เพื่อสร้างชีต `employees`, `attendance`, `leave`
5. เลือก **Deploy → New deployment → Web app** เพื่อรับ URL สำหรับใช้งาน

## ข้อควรระวัง

- ห้าม commit `.clasp.json` เพราะระบุ Script ID ของระบบจริง
- กำหนดสิทธิ์ Web app ให้ตรงกับนโยบายองค์กร
- ตรวจสอบและปรับฟังก์ชัน `vacationDays_` ใน `Code.gs` ตามรูปตารางสิทธิ์พักร้อนของบริษัทก่อนใช้งานจริง
