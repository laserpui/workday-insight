/** Workday Insight — Google Apps Script backend */
const SHEETS = {
  employees: ['Employee ID', 'Name', 'Start Date'],
  attendance: ['Record ID', 'Date', 'Employee ID', 'Late Minutes'],
  leave: ['Record ID', 'Date', 'Employee ID', 'Type', 'Days', 'Note']
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Workday Insight')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(name => ensureSheet_(ss, name, SHEETS[name]));
  return 'สร้างและตรวจสอบฐานข้อมูลเรียบร้อย';
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else if ((name === 'attendance' || name === 'leave') && String(sheet.getRange(1, 1).getValue()).trim() !== 'Record ID') {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue('Record ID');
    if (sheet.getLastRow() > 1) {
      const ids = Array.from({ length: sheet.getLastRow() - 1 }, () => [Utilities.getUuid().slice(0, 12)]);
      sheet.getRange(2, 1, ids.length, 1).setValues(ids);
    }
  }

  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}

function getDashboardData(filters) {
  setupDatabase();
  const normalized = normalizeFilters_(filters);
  const ss = SpreadsheetApp.getActive();
  const employeeOptions = readRows_(ss.getSheetByName('employees'))
    .filter(row => row[0] && row[1])
    .map(row => ({ id: String(row[0]), name: String(row[1]), startDate: dateText_(row[2]) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));

  const attendance = readRows_(ss.getSheetByName('attendance')).map(row => ({
    id: String(row[0]), date: dateText_(row[1]), employeeId: String(row[2]), lateMinutes: Number(row[3] || 0)
  }));
  const leaves = readRows_(ss.getSheetByName('leave')).map(row => ({
    id: String(row[0]), date: dateText_(row[1]), employeeId: String(row[2]), type: String(row[3]), days: Number(row[4] || 0), note: String(row[5] || '')
  }));

  const inRange = record => record.date >= normalized.startDate && record.date <= normalized.endDate;
  const monthInRange = record => record.date.slice(0, 7) >= normalized.startDate.slice(0, 7) &&
    record.date.slice(0, 7) <= normalized.endDate.slice(0, 7);
  const forEmployee = record => !normalized.employeeId || record.employeeId === normalized.employeeId;
  const filteredAttendance = attendance.filter(record => monthInRange(record) && forEmployee(record));
  const filteredLeaves = leaves.filter(record => inRange(record) && forEmployee(record));
  const selectedEmployees = employeeOptions.filter(emp => !normalized.employeeId || emp.id === normalized.employeeId);
  const employees = selectedEmployees.map(emp => calculateEmployee_(emp, filteredAttendance, filteredLeaves, normalized, leaves));
  const nameMap = employeeOptions.reduce((map, emp) => (map[emp.id] = emp.name, map), {});
  const monthlyLateMap = filteredAttendance.reduce((map, record) => {
    const key = record.employeeId + '|' + record.date.slice(0, 7);
    map[key] = (map[key] || 0) + record.lateMinutes;
    return map;
  }, {});
  const records = filteredAttendance.map(record => {
    const key = record.employeeId + '|' + record.date.slice(0, 7);
    return {
      ...record,
      kind: 'attendance',
      employeeName: nameMap[record.employeeId] || record.employeeId,
      score: lateScore_(monthlyLateMap[key])
    };
  })
    .concat(filteredLeaves.map(record => ({ ...record, kind: 'leave', employeeName: nameMap[record.employeeId] || record.employeeId })))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  return {
    filters: normalized,
    employeeOptions,
    employees,
    records,
    summary: summarize_(employees)
  };
}

function saveEmployee(data) {
  return withLock_(() => {
    setupDatabase();
    if (!String(data.name || '').trim()) throw new Error('กรุณาระบุชื่อพนักงาน');
    if (!data.startDate) throw new Error('กรุณาระบุวันที่เริ่มงาน');
    const sheet = SpreadsheetApp.getActive().getSheetByName('employees');
    if (data.id) {
      const row = findRowById_(sheet, data.id);
      if (!row) throw new Error('ไม่พบพนักงานที่ต้องการแก้ไข');
      sheet.getRange(row, 2, 1, 2).setValues([[String(data.name).trim(), parseDate_(data.startDate)]]);
    } else {
      sheet.appendRow([Utilities.getUuid().slice(0, 8), String(data.name).trim(), parseDate_(data.startDate)]);
    }
    return getDashboardData(data.filters);
  });
}

function addEmployee(data) { return saveEmployee(data); }
function updateEmployee(data) { return saveEmployee(data); }

function deleteEmployee(data) {
  return withLock_(() => {
    setupDatabase();
    const employeeId = String(data.employeeId || data.id || '');
    if (!employeeId) throw new Error('ไม่พบรหัสพนักงาน');
    const ss = SpreadsheetApp.getActive();
    ['attendance', 'leave'].forEach(name => deleteRowsByValue_(ss.getSheetByName(name), 3, employeeId));
    const sheet = ss.getSheetByName('employees');
    const row = findRowById_(sheet, employeeId);
    if (!row) throw new Error('ไม่พบพนักงานที่ต้องการลบ');
    sheet.deleteRow(row);
    return getDashboardData(data.filters);
  });
}

function saveAttendance(data) {
  return withLock_(() => {
    setupDatabase();
    if (!data.employeeId) throw new Error('กรุณาเลือกพนักงาน');
    const month = normalizeMonth_(data.month || data.date);
    const lateMinutes = Number(data.lateMinutes);
    if (!Number.isFinite(lateMinutes) || lateMinutes < 0 || !Number.isInteger(lateMinutes)) {
      throw new Error('เวลาสายรวมต้องเป็นจำนวนนาทีตั้งแต่ 0 ขึ้นไป');
    }
    upsertMonthlyAttendance_(data.id, month, String(data.employeeId), lateMinutes);
    return getDashboardData(data.filters);
  });
}

function addAttendance(data) { return saveAttendance(data); }
function updateAttendance(data) { return saveAttendance(data); }

function saveLeave(data) {
  return withLock_(() => {
    setupDatabase();
    validateRecord_(data);
    const allowedTypes = ['sick', 'personal', 'vacation', 'other'];
    if (!allowedTypes.includes(data.type)) throw new Error('ประเภทการลาไม่ถูกต้อง');
    const days = Number(data.days || 0);
    if (!(days > 0)) throw new Error('จำนวนวันลาต้องมากกว่า 0');
    const values = [parseDate_(data.date), String(data.employeeId), data.type, days, String(data.note || '').trim()];
    upsertRecord_('leave', data.id, values);
    return getDashboardData(data.filters);
  });
}

function addLeave(data) { return saveLeave(data); }
function updateLeave(data) { return saveLeave(data); }

function deleteRecord(data) {
  return withLock_(() => {
    setupDatabase();
    const sheetName = data.kind === 'attendance' ? 'attendance' : data.kind === 'leave' ? 'leave' : '';
    if (!sheetName) throw new Error('ประเภทรายการไม่ถูกต้อง');
    const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
    const row = findRowById_(sheet, data.id);
    if (!row) throw new Error('ไม่พบรายการที่ต้องการลบ');
    sheet.deleteRow(row);
    return getDashboardData(data.filters);
  });
}

function validateRecord_(data) {
  if (!data.employeeId) throw new Error('กรุณาเลือกพนักงาน');
  if (!data.date) throw new Error('กรุณาระบุวันที่');
}

function upsertRecord_(sheetName, id, values) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (id) {
    const row = findRowById_(sheet, id);
    if (!row) throw new Error('ไม่พบรายการที่ต้องการแก้ไข');
    sheet.getRange(row, 2, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow([Utilities.getUuid().slice(0, 12)].concat(values));
  }
}

function findRowById_(sheet, id) {
  if (sheet.getLastRow() < 2) return 0;
  const found = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  return found ? found.getRow() : 0;
}

function deleteRowsByValue_(sheet, column, value) {
  if (sheet.getLastRow() < 2) return;
  const values = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(value)) sheet.deleteRow(i + 2);
  }
}

function readRows_(sheet) {
  return sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}

function dateText_(value) {
  return value instanceof Date
    ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd')
    : String(value || '').slice(0, 10);
}

function parseDate_(value) {
  const parts = String(value).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) throw new Error('รูปแบบวันที่ไม่ถูกต้อง');
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function normalizeMonth_(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) throw new Error('กรุณาระบุเดือน');
  return match[1] + '-' + match[2];
}

function upsertMonthlyAttendance_(id, month, employeeId, lateMinutes) {
  const sheet = SpreadsheetApp.getActive().getSheetByName('attendance');
  const rows = readRows_(sheet);
  let targetRow = id ? findRowById_(sheet, id) : 0;
  if (id && !targetRow) throw new Error('ไม่พบรายการที่ต้องการแก้ไข');

  const matchingRows = [];
  rows.forEach((row, index) => {
    if (dateText_(row[1]).slice(0, 7) === month && String(row[2]) === employeeId) matchingRows.push(index + 2);
  });
  if (!targetRow && matchingRows.length) targetRow = matchingRows[0];

  const values = [parseDate_(month + '-01'), employeeId, lateMinutes];
  if (targetRow) {
    sheet.getRange(targetRow, 2, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow([Utilities.getUuid().slice(0, 12)].concat(values));
    targetRow = sheet.getLastRow();
  }

  matchingRows
    .filter(row => row !== targetRow)
    .sort((a, b) => b - a)
    .forEach(row => sheet.deleteRow(row));
}

function normalizeFilters_(filters) {
  const now = new Date();
  const currentYear = Number(Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy'));
  const currentMonth = Utilities.formatDate(now, Session.getScriptTimeZone(), 'MM');
  const currentMonthStart = currentYear + '-' + currentMonth + '-01';
  const currentMonthEnd = currentYear + '-' + currentMonth + '-' + String(new Date(currentYear, Number(currentMonth), 0).getDate()).padStart(2, '0');
  if (typeof filters === 'string' || typeof filters === 'number') {
    const year = Number(filters) || currentYear;
    return { startDate: year + '-01-01', endDate: year + '-12-31', employeeId: '' };
  }
  const startDate = filters && filters.startDate ? String(filters.startDate) : currentMonthStart;
  const endDate = filters && filters.endDate ? String(filters.endDate) : currentMonthEnd;
  if (startDate > endDate) throw new Error('วันเริ่มต้นต้องไม่เกินวันสิ้นสุด');
  return { startDate, endDate, employeeId: String(filters && filters.employeeId || '') };
}

function calculateEmployee_(emp, attendance, leaves, filters, allLeaves) {
  const monthlyAttendance = monthsInRange_(filters.startDate, filters.endDate).map(month => {
    const lateMinutes = attendance
      .filter(row => row.employeeId === emp.id && row.date.slice(0, 7) === month)
      .reduce((sum, row) => sum + row.lateMinutes, 0);
    return { month, lateMinutes, score: lateScore_(lateMinutes) };
  });
  const lateMinutes = monthlyAttendance.reduce((sum, month) => sum + month.lateMinutes, 0);
  const attendanceScore = monthlyAttendance.length
    ? Math.round(monthlyAttendance.reduce((sum, month) => sum + month.score, 0) / monthlyAttendance.length * 10) / 10
    : 100;
  const used = { sick: 0, personal: 0, vacation: 0, other: 0 };
  leaves.filter(row => row.employeeId === emp.id).forEach(row => {
    if (row.type in used) used[row.type] += row.days;
  });
  const entitlementYear = Number(filters.endDate.slice(0, 4));
  const entitlementUsed = { sick: 0, personal: 0, vacation: 0, other: 0 };
  allLeaves.filter(row => row.employeeId === emp.id && row.date.slice(0, 4) === String(entitlementYear)).forEach(row => {
    if (row.type in entitlementUsed) entitlementUsed[row.type] += row.days;
  });
  const vacationEntitlement = vacationDays_(emp.startDate, entitlementYear);
  return {
    ...emp,
    lateMinutes,
    attendanceScore,
    monthlyAttendance,
    used,
    remaining: {
      sick: Math.max(0, 30 - entitlementUsed.sick),
      personal: Math.max(0, 5 - entitlementUsed.personal),
      vacation: Math.max(0, vacationEntitlement - entitlementUsed.vacation)
    },
    vacationEntitlement
  };
}

function lateScore_(lateMinutes) {
  const minutes = Math.max(0, Number(lateMinutes) || 0);
  if (minutes < 30) return 100;
  if (minutes < 60) return 90;
  if (minutes < 90) return 80;
  if (minutes < 120) return 70;
  return 60;
}

function monthsInRange_(startDate, endDate) {
  const start = String(startDate).slice(0, 7).split('-').map(Number);
  const end = String(endDate).slice(0, 7).split('-').map(Number);
  const months = [];
  let year = start[0];
  let month = start[1];
  while (year < end[0] || (year === end[0] && month <= end[1])) {
    months.push(year + '-' + String(month).padStart(2, '0'));
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return months;
}

function vacationDays_(startDate, year) {
  const start = parseDate_(startDate);
  const end = new Date(year, 0, 1);
  const years = Math.max(0, end.getFullYear() - start.getFullYear() - ((end.getMonth() < start.getMonth() || (end.getMonth() === start.getMonth() && end.getDate() < start.getDate())) ? 1 : 0));
  if (years < 1) return 0;
  if (years < 3) return 6;
  if (years < 6) return 8;
  if (years < 9) return 10;
  if (years < 12) return 12;
  if (years < 15) return 14;
  return 15;
}

function summarize_(employees) {
  return {
    total: employees.length,
    lateMinutes: employees.reduce((sum, emp) => sum + emp.lateMinutes, 0),
    leaveDays: employees.reduce((sum, emp) => sum + Object.values(emp.used).reduce((a, b) => a + b, 0), 0),
    attendanceScore: employees.length
      ? Math.round(employees.reduce((sum, emp) => sum + emp.attendanceScore, 0) / employees.length * 10) / 10
      : 0
  };
}

function withLock_(callback) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try { return callback(); } finally { lock.releaseLock(); }
}
