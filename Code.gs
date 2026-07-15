/** Attendance & Leave Dashboard — Google Apps Script backend */
const SHEETS = {
  employees: ['Employee ID', 'Name', 'Start Date'],
  attendance: ['Date', 'Employee ID', 'Late Minutes'],
  leave: ['Date', 'Employee ID', 'Type', 'Days', 'Note']
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Workday Insight')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

function setupDatabase() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  return 'สร้างฐานข้อมูลเรียบร้อย';
}

function getDashboardData(year) {
  setupDatabase();
  const ss = SpreadsheetApp.getActive();
  const employees = readRows_(ss.getSheetByName('employees')).map(r => ({ id: String(r[0]), name: r[1], startDate: dateText_(r[2]) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const attendance = readRows_(ss.getSheetByName('attendance'));
  const leaves = readRows_(ss.getSheetByName('leave'));
  const selectedYear = Number(year) || new Date().getFullYear();
  const result = employees.map(emp => calculateEmployee_(emp, attendance, leaves, selectedYear));
  return { year: selectedYear, employees: result, summary: summarize_(result) };
}

function addEmployee(data) {
  const sh = SpreadsheetApp.getActive().getSheetByName('employees');
  sh.appendRow([Utilities.getUuid().slice(0, 8), data.name, new Date(data.startDate)]);
  return getDashboardData(new Date().getFullYear());
}

function addAttendance(data) {
  SpreadsheetApp.getActive().getSheetByName('attendance').appendRow([new Date(data.date), data.employeeId, Number(data.lateMinutes)]);
  return getDashboardData(new Date(data.date).getFullYear());
}

function addLeave(data) {
  SpreadsheetApp.getActive().getSheetByName('leave').appendRow([new Date(data.date), data.employeeId, data.type, Number(data.days), data.note || '']);
  return getDashboardData(new Date(data.date).getFullYear());
}

function readRows_(sheet) { return sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues(); }
function dateText_(value) { return value instanceof Date ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(value || ''); }

function calculateEmployee_(emp, attendance, leaves, year) {
  const id = emp.id;
  const inYear = row => { const d = new Date(row[0]); return String(d.getFullYear()) === String(year); };
  const lateMinutes = attendance.filter(r => String(r[1]) === id && inYear(r)).reduce((n, r) => n + Number(r[2] || 0), 0);
  const used = { sick: 0, personal: 0, vacation: 0, other: 0 };
  leaves.filter(r => String(r[1]) === id && inYear(r)).forEach(r => { const key = r[2]; if (key in used) used[key] += Number(r[3] || 0); });
  const vacationEntitlement = vacationDays_(emp.startDate, year);
  return { ...emp, lateMinutes, used, remaining: { sick: Math.max(0, 30 - used.sick), personal: Math.max(0, 5 - used.personal), vacation: Math.max(0, vacationEntitlement - used.vacation) }, vacationEntitlement };
}

// ปรับตารางวันพักร้อนตามนโยบายบริษัทได้ที่นี่ (ตัดสิทธิ์ใหม่ทุก 1 ม.ค.)
function vacationDays_(startDate, year) {
  const start = new Date(startDate); const end = new Date(year, 0, 1);
  const years = Math.max(0, end.getFullYear() - start.getFullYear() - ((end.getMonth() < start.getMonth() || (end.getMonth() === start.getMonth() && end.getDate() < start.getDate())) ? 1 : 0));
  if (years < 1) return 0;
  if (years < 3) return 6;
  if (years < 5) return 8;
  return 10;
}

function summarize_(employees) {
  return { total: employees.length, lateMinutes: employees.reduce((n, e) => n + e.lateMinutes, 0), leaveDays: employees.reduce((n, e) => n + Object.values(e.used).reduce((a, b) => a + b, 0), 0), atRisk: employees.filter(e => e.lateMinutes >= 60).length };
}
