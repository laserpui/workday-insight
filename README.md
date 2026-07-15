# Workday Insight

เว็บแอปบันทึกเวลาเข้างานและวันลา โดยใช้ Google Sheets เป็นฐานข้อมูล

## วิธีใช้งาน

1. สร้าง Google Sheet ใหม่ แล้วเปิด **Extensions → Apps Script**
2. สร้างไฟล์ `Code.gs`, `Index.html`, `Styles.html`, `Scripts.html` และวางเนื้อหาจากโปรเจกต์นี้
3. ตั้งค่า Project Settings → Time zone เป็น `Asia/Bangkok`
4. รัน `setupDatabase` หนึ่งครั้งและอนุญาตสิทธิ์ ระบบจะสร้างชีต `employees`, `attendance`, `leave`
5. Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone with Google account

## สิทธิ์ลา

- ลาป่วย 30 วันต่อปี
- ลากิจ 5 วันต่อปี
- พักร้อน: ค่าเริ่มต้นใน `vacationDays_` คือ 6 วัน (อายุงาน 1–2 ปี), 8 วัน (3–4 ปี), 10 วัน (5 ปีขึ้นไป) และเริ่มรอบสิทธิ์ใหม่วันที่ 1 มกราคม สามารถแก้ตามตารางนโยบายบริษัทได้ใน `Code.gs`

> หากมีรูปตารางสิทธิ์พักร้อน กรุณาแนบเพิ่ม เพื่อแทนที่เงื่อนไขตัวอย่างนี้ให้ตรงนโยบายบริษัท
