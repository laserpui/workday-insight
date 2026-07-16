# นำ Workday Insight ขึ้น GitHub Pages

โปรเจกต์นี้มีสองส่วน:

- ไฟล์ Google Apps Script ได้แก่ Code.gs, index.html, Styles.html และ Scripts.html ทำงานกับ Google Sheets และ Gemini API
- โฟลเดอร์ **docs/** เป็นหน้าเว็บสำหรับ GitHub Pages ซึ่งเปิด Google Apps Script Web App ผ่าน iframe

> GitHub Pages เป็นเว็บแบบ Static จึงไม่สามารถรัน Code.gs หรือคำสั่ง include ของ Apps Script ได้โดยตรง

## 1. Deploy Google Apps Script ก่อน

1. อัปเดตไฟล์ใน Apps Script จากโปรเจกต์นี้
2. รัน setupDatabase หนึ่งครั้ง
3. ตั้งค่า GEMINI_API_KEY ใน **Project Settings → Script Properties** หากต้องการใช้ AI
4. เลือก **Deploy → New deployment → Web app**
5. คัดลอก URL ที่ลงท้ายด้วย /exec

## 2. ตั้งค่า URL สำหรับ GitHub Pages

เปิดไฟล์ **docs/config.js** แล้วแก้ค่า appUrl:

~~~js
window.WORKDAY_CONFIG = {
  appUrl: 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec'
};
~~~

## 3. Push ขึ้น GitHub

สร้าง Repository ใน GitHub แล้วรัน:

~~~bash
git init
git add .
git commit -m "Publish Workday Insight"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
~~~

หาก Repository มี remote อยู่แล้ว ให้ใช้เพียง git add, git commit และ git push

## 4. เปิด GitHub Pages

1. เปิด Repository → **Settings → Pages**
2. ใน **Build and deployment** เลือก **Deploy from a branch**
3. Branch เลือก main
4. Folder เลือก /docs
5. กด **Save**

หน้าเว็บจะอยู่ที่:

~~~text
https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/
~~~

## เมื่ออัปเดตระบบ

- หากแก้เฉพาะหน้า GitHub ให้ push ไฟล์ในโฟลเดอร์ docs
- หากแก้ Apps Script ให้ Deploy เวอร์ชันใหม่
- ถ้า URL /exec เปลี่ยน ให้แก้ docs/config.js แล้ว push อีกครั้ง

## ความปลอดภัย

- ห้ามใส่ GEMINI_API_KEY ในไฟล์บน GitHub ให้เก็บไว้ใน Apps Script Script Properties เท่านั้น
- ไฟล์ .clasp.json ถูกละเว้นด้วย .gitignore เพราะมี Script ID
- กำหนดสิทธิ์ Web App ให้สอดคล้องกับนโยบายข้อมูลพนักงานขององค์กร
