/**
 * Printer Management Pro - Google Apps Script backend
 *
 * วิธีใช้งาน:
 * 1) แนะนำให้สร้าง Apps Script จาก Google Sheet เป้าหมาย (Bound script)
 * 2) วางไฟล์นี้เป็น Code.gs
 * 3) Deploy > New deployment > Web app
 * 4) Execute as: Me, Who has access: Anyone
 * 5) นำ URL /exec ไปใส่ใน appsScriptUrl ของไฟล์ HTML
 *
 * หากใช้ Standalone script ให้เพิ่ม Script Property ชื่อ SPREADSHEET_ID
 * โดยไม่ต้องเขียน Spreadsheet ID ลงใน source code
 */

const CONFIG = Object.freeze({
  SHEET_NAME: 'Printers',
  MAX_RECORDS: 5000,
  LOCK_TIMEOUT_MS: 30000
});

const SUPPORTED_ACTIONS = Object.freeze(['syncPrinters', 'saveToSheet']);

const HEADERS = Object.freeze([
  'ID',
  'Printer Name',
  'IP Address',
  'Location',
  'Type',
  'Status',
  'Last Updated',
  'Note',
  'Synced At'
]);

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.webAppUrl = ScriptApp.getService().getUrl() || '';
  return template
    .evaluate()
    .setTitle('Printer Management Pro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function doPost(event) {
  try {
    const payload = parsePayload_(event);
    verifyApiSecret_(payload.token);
    if (payload.action === 'getPrinters') {
      return jsonResponse_(getPrintersFromSheet());
    }
    return jsonResponse_(savePrintersToSheet(payload));
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function verifyApiSecret_(providedToken) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty('API_SHARED_SECRET');
  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    throw new Error('Unauthorized API request');
  }
}

function savePrintersToSheet(payload) {
  let lock;
  let hasLock = false;
  try {
    payload = payload || {};
    if (SUPPORTED_ACTIONS.indexOf(payload.action) === -1) throw new Error('Unsupported action: ' + String(payload.action || 'missing'));
    const printers = normalizePrinters_(payload.printers);
    lock = LockService.getScriptLock();
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    hasLock = true;
    const sheet = getTargetSheet_();
    migrateMacColumnIfNeeded_(sheet);
    syncPrinters_(sheet, printers, payload.updatedAt);
    return { ok: true, action: payload.action, syncedRows: printers.length, syncedAt: new Date().toISOString() };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    if (hasLock && lock) lock.releaseLock();
  }
}

function getPrintersFromSheet() {
  let lock;
  let hasLock = false;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    hasLock = true;

    const sheet = getTargetSheet_();
    if (sheet.getLastRow() === 0) {
      ensureSheetCapacity_(sheet, 2, HEADERS.length);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
    }

    const values = sheet.getDataRange().getValues();
    return {
      ok: true,
      printers: mapSheetRowsByHeader_(values),
      syncedAt: new Date().toISOString(),
      schemaVersion: 2
    };
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    if (hasLock && lock) lock.releaseLock();
  }
}
function parsePayload_(event) {
  const contents = event && event.postData && event.postData.contents;
  if (!contents) throw new Error('Request body is empty');

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error('Request body must be valid JSON');
  }
}

function normalizePrinters_(value) {
  if (!Array.isArray(value)) throw new Error('printers must be an array');
  if (value.length > CONFIG.MAX_RECORDS) {
    throw new Error('Too many records; maximum is ' + CONFIG.MAX_RECORDS);
  }

  const seenIds = new Set();
  return value.map(function (printer, index) {
    if (!printer || typeof printer !== 'object') {
      throw new Error('Invalid printer at index ' + index);
    }

    const id = safeText_(printer.id, 200);
    const name = safeText_(printer.name, 500);
    const ip = safeText_(printer.ip, 100);
    if (!id || !name || !ip) {
      throw new Error('Printer at index ' + index + ' requires id, name and ip');
    }
    if (seenIds.has(id)) throw new Error('Duplicate printer id: ' + id);
    seenIds.add(id);

    return {
      id: id,
      name: name,
      ip: ip,
      location: safeText_(printer.location, 500),
      type: safeText_(printer.type, 500),
      status: safeText_(printer.status, 100),
      lastUpdated: safeText_(printer.lastUpdated, 200),
      note: safeText_(printer.note, 5000)
    };
  });
}

function mapSheetRowsByHeader_(values) {
  if (!Array.isArray(values) || values.length < 2) return [];

  const headerIndexes = {};
  values[0].forEach(function (header, index) {
    headerIndexes[safeText_(header, 200).toLowerCase()] = index;
  });

  function cell_(row, header) {
    const index = headerIndexes[header.toLowerCase()];
    return index === undefined ? '' : row[index];
  }

  const records = values.slice(1).map(function (row) {
    return {
      id: cell_(row, 'ID'),
      name: cell_(row, 'Printer Name'),
      ip: cell_(row, 'IP Address'),
      location: cell_(row, 'Location'),
      type: cell_(row, 'Type'),
      status: cell_(row, 'Status'),
      lastUpdated: cell_(row, 'Last Updated'),
      note: cell_(row, 'Note')
    };
  }).filter(function (printer) {
    return safeText_(printer.id, 200) && safeText_(printer.name, 500) && safeText_(printer.ip, 100);
  });

  return normalizePrinters_(records);
}

function getTargetSheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  const spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId.trim())
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error('ไม่พบ Google Sheet: ใช้ Bound script หรือกำหนด Script Property ชื่อ SPREADSHEET_ID');
  }

  return spreadsheet.getSheetByName(CONFIG.SHEET_NAME)
    || spreadsheet.insertSheet(CONFIG.SHEET_NAME);
}

function syncPrinters_(sheet, printers, clientUpdatedAt) {
  ensureSheetCapacity_(sheet, Math.max(printers.length + 1, 2), HEADERS.length);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.setFrozenRows(1);

  const existingDataRows = Math.max(sheet.getLastRow() - 1, 0);
  if (existingDataRows > 0) {
    sheet.getRange(2, 1, existingDataRows, HEADERS.length).clearContent();
  }

  if (printers.length === 0) return;

  const syncedAt = normalizeIsoDate_(clientUpdatedAt) || new Date().toISOString();
  const rows = printers.map(function (printer) {
    return [
      safeCell_(printer.id),
      safeCell_(printer.name),
      safeCell_(printer.ip),
      safeCell_(printer.location),
      safeCell_(printer.type),
      safeCell_(printer.status),
      safeCell_(printer.lastUpdated),
      safeCell_(printer.note),
      syncedAt
    ];
  });

  sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
}

function migrateMacColumnIfNeeded_(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1 || sheet.getLastRow() < 1) return;

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(function (header) { return safeText_(header, 200); });
  const macColumnIndex = headers.indexOf('MAC Address');
  if (macColumnIndex === -1) return;

  const spreadsheet = sheet.getParent();
  const backupPrefix = 'Printers_MAC_Backup_';
  const alreadyBackedUp = spreadsheet.getSheets().some(function (candidate) {
    return candidate.getName().indexOf(backupPrefix) === 0;
  });

  if (!alreadyBackedUp) {
    const timeZone = typeof Session !== 'undefined' ? Session.getScriptTimeZone() : 'Asia/Bangkok';
    const suffix = Utilities.formatDate(new Date(), timeZone, 'yyyyMMdd_HHmmss');
    const backup = sheet.copyTo(spreadsheet).setName(backupPrefix + suffix);
    backup.hideSheet();
  }

  sheet.deleteColumn(macColumnIndex + 1);
}

function ensureSheetCapacity_(sheet, requiredRows, requiredColumns) {
  if (sheet.getMaxRows() < requiredRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < requiredColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
  }
}

function safeText_(value, maxLength) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, maxLength);
}

function safeCell_(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function normalizeIsoDate_(value) {
  if (!value) return '';
  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date.toISOString();
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

