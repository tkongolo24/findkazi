/**
 * findkazi → Google Sheet
 *
 * Receives user-test results from the findkazi Facilitator page
 * ("Send to Google Sheet" button) and adds one row per participant.
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
  'Received', 'Participant', 'Site language',
  'CV time (s)', 'CV help taps', 'CV checks', 'CV problems', 'CV completed', 'CV observation',
  'Email time (s)', 'Email help taps', 'Email checks', 'Email problems', 'Email completed', 'Email observation',
  'Apply time (s)', 'Apply help taps', 'Apply submits', 'Apply problems', 'Apply completed', 'Apply observation',
  'Notes'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    }
    var d = JSON.parse(e.postData.contents);
    var row = [new Date(), clean(d.participant), clean(d.language)];
    ['cv', 'email', 'apply'].forEach(function (s) {
      var m = (d.steps && d.steps[s]) || {};
      row.push(num(m.seconds), num(m.help), num(m.attempts), num(m.errors), m.completed ? 'Yes' : 'No', clean(m.observation));
    });
    row.push(clean(d.notes, 2000));
    sheet.appendRow(row);
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
  return ContentService.createTextOutput('findkazi sheet is ready.');
}

function num(v) { v = Number(v); return isFinite(v) ? v : ''; }

/* Plain text only, trimmed, and never starting with = + - @ so the sheet can't run it as a formula. */
function clean(v, max) {
  var s = String(v == null ? '' : v).slice(0, max || 200).trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
