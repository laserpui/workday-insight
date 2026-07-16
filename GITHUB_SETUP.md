# นำ Workday Insight ขึ้น GitHub Pages

โปรเจกต์แบ่งเป็นสองส่วน:

- ไฟล์ Google Apps Script ได้แก่ `Code.gs`, `index.html`, `Styles.html` และ `Scripts.html` ทำงานกับ Google Sheets
- โฟลเดอร์ `docs/` เป็นหน้า GitHub Pages ที่เปิด Google Apps Script Web App ผ่าน iframe

> GitHub Pages เป็นเว็บแบบ Static จึงไม่สามารถรัน `Code.gs` หรือคำสั่ง include ของ Apps Script ได้โดยตรง

## 1. Deploy Google Apps Script

1. อัปเดตไฟล์ใน Apps Script จากโปรเจกต์นี้
2. รัน `setupDatabase` หนึ่งครั้ง
3. เลือก **Deploy → New deployment → Web app**
4. คัดลอก URL ที่ลงท้ายด้วย `/exec`

## 2. ตั้งค่า URL สำหรับ GitHub Pages

แก้ค่า `appUrl` ใน `docs/config.js` ให้เป็น URL ของ Web App:

```js
window.WORKDAY_CONFIG = {
  appUrl: 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec'
};
```

## 3. เปิด GitHub Pages

1. Push โปรเจกต์ขึ้น GitHub
2. เปิด **Settings → Pages**
3. เลือก **Deploy from a branch**, branch `main`, folder `/docs` แล้วกด Save

## เมื่ออัปเดตระบบ

- หากแก้ไฟล์ Apps Script ให้สร้าง deployment version ใหม่
- หาก URL `/exec` เปลี่ยน ให้แก้ `docs/config.js` และ push อีกครั้ง
- กำหนดสิทธิ์ Web App ให้สอดคล้องกับนโยบายข้อมูลพนักงานขององค์กร
