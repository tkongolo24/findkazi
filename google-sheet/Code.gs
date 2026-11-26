/**
 * findkazi → Google Sheet
 *
 * Receives user-test results from the findkazi site. Each phone/browser has a
 * random session id; the site sends progress automatically and the Facilitator
 * page can send it with a participant code. The sheet keeps ONE row per session
 * and updates it every time new results arrive.
 *
 * Setup (once):
 *  1. Create a Google Sheet (e.g. "findkazi results").
 *  2. Extensions → Apps Script. Delete what is there and paste this whole file. Save.
 *  3. Deploy → New deployment → type "Web app".
 *       Execute as: Me
 *       Who has access: Anyone
 *     Click Deploy, allow the permissions, and copy the "Web app URL" (ends in /exec).
 *  4. Put that URL in js/config.js on the site.
 *
 * No personal details (names, phone numbers, CVs) are sent — only the
 * participant code, timings, counts, observations and facilitator notes.
 */

var HEADERS = [
  'Last updated', 'Participant', 'Site language',
  'CV time (s)', 'CV help taps', 'CV checks', 'CV problems', 'CV completed', 'CV observation',
  'Email time (s)', 'Email help taps', 'Email checks', 'Email problems', 'Email completed', 'Email observation',
  'Apply time (s)', 'Apply help taps', 'Apply submits', 'Apply problems', 'Apply completed', 'Apply observation',
  'Notes', 'Session ID', 'Sent by', 'Steps completed (of 3)'
];
var SESSION_COL = HEADERS.indexOf('Session ID') + 1;

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var head = sheet.getRange(1, 1, 1, HEADERS.length);
    if (sheet.getLastRow() === 0 || head.getValues()[0].join('|') !== HEADERS.join('|')) {
      head.setValues([HEADERS]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    var d = JSON.parse(e.postData.contents);
    var row = [new Date(), clean(d.participant), clean(d.language)];
    ['cv', 'email', 'apply'].forEach(function (s) {
      var m = (d.steps && d.steps[s]) || {};
      row.push(num(m.seconds), num(m.help), num(m.attempts), num(m.errors), m.completed ? 'Yes' : 'No', clean(m.observation));
    });
    row.push(clean(d.notes, 2000), clean(d.session, 40), d.source === 'facilitator' ? 'Facilitator' : 'Automatic', num(d.stepsDone));

    var at = findSessionRow(sheet, row[SESSION_COL - 1]);
    if (at) sheet.getRange(at, 1, 1, row.length).setValues([row]);
    else sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/* Visiting the URL in a browser shows this, so you can check the deployment works. */
function doGet() {
  return ContentService.createTextOutput('findkazi sheet is ready (v2).');
}

/* Row number already holding this session, or 0. */
function findSessionRow(sheet, session) {
  var last = sheet.getLastRow();
  if (!session || last < 2) return 0;
  var ids = sheet.getRange(2, SESSION_COL, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === session) return i + 2;
  return 0;
}

function num(v) { v = Number(v); return isFinite(v) ? v : ''; }

/* Plain text only, trimmed, and never starting with = + - @ so the sheet can't run it as a formula. */
function clean(v, max) {
  var s = String(v == null ? '' : v).slice(0, max || 200).trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
