function getSheet (sheetOrName) {
  var sheet;
  if (typeof sheetOrName === 'string') {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetOrName);
  } else if (typeof sheetOrName === 'object' && 'getRange' in sheetOrName) {
    sheet = sheetOrName;
  }

  return sheet;
}

function getSelectedRangeRows (sheetOrName) {
  var sheet = getSheet(sheetOrName);

  var selectedRange = SpreadsheetApp.getActiveRange(),
      firstRowIndex = selectedRange.getRowIndex(),
      lastRowIndex = firstRowIndex + selectedRange.getNumRows() - 1;

  return sheet.getRange(firstRowIndex.toString() + ":" + lastRowIndex.toString());
}

function getSheetDataRange (sheetOrName, skipHeaderRow) {
  var sheet = getSheet(sheetOrName),
      range = sheet.getDataRange(),
      rowStart = 1,
      rowEnd = range.getNumRows();

  if (skipHeaderRow) {
    rowStart = 2;
    rowEnd -= 1;
  }

  return sheet.getRange(rowStart, 1, rowEnd, range.getNumColumns());
}

function processRange (range, rowProcessor) {
  // iterates thru range and calls rowProcessor function for each row

  var sheet = range.getSheet(),
      header = getHeader(sheet),
      rangeValues = range.getValues(),
      i, obj;

  for (i = 0; i <= rangeValues.length-1; i++) {
    obj = getObjectFromRow(rangeValues[i], header);
    rowProcessor(obj);
  }
}

function getFirstBlankRow (sheet) {
  var blankRow = sheet.getLastRow() + 1;

  row = sheet.getRange(blankRow.toString() + ":" + blankRow.toString());
  if (!row) {
    sheet.insertRowAfter();
    return getFirstBlankRow(sheet);
  }
  return row;
}

function showError (msg) {
  // Shows an error
  var ui = SpreadsheetApp.getUi();
  ui.alert("Error", msg, ui.ButtonSet.OK);
}

function getHeader (sheet) {
  return sheet.getRange("1:1").getValues()[0].filter(function (el) { return Boolean(el); });
}

function getColumnIndex (columnName, header) {
  return header.indexOf(columnName);
}

function getColumnValue (row, columnName, header) {
  return row[getColumnIndex(columnName, header)];
}

function getObjectFromRow(row, header) {
  // Make an object from row and header arrays
  // header values become object's keys and row values appropriate attribute values
  var i,
      lenHeader = header.length,
      obj = {};

  for (i = 0; i < lenHeader; i++) {
    if (header[i]) {
      obj[header[i]] = row[i];
    }
  }
  return obj;
}

function makeRowFromObject (data, header) {
  // Make a row from data object
  var row = [];

  for (var i = 0; i < header.length; i++) {
    row.push(data[header[i]] || '');
  }
  return row;
}

function padLeft(str, len, pad) {
  return str.length >= len ? str : padLeft(pad + str, len);
}

// filter functions

function filterMatch (obj, filter) {
  // Returns true if object with arbitrary number of keys
  // matches values for all keys in filter

  var f, isMatch = true;

  for (f in filter) {
    isMatch = isMatch && (f in obj) && (obj[f] === filter[f]);
    if (!isMatch) break;
  }
  return isMatch;
}

function filterRows (sheet, filter) {
  // Filters a sheet (its DataRange) and returns only those rows
  // that match a filter object.
  // Each key value pair from filter object is compared to row
  // and if sheet has all columns named the same as a keys from filter
  // and if row's column values match the values of a filter
  //
  // returns a list of objects that match the filter criteria

  var header = getHeader(sheet),
      data = sheet.getDataRange().getValues(),
      r, result = [];

  for (r = 0; r < data.length; r++) {
    obj = getObjectFromRow(data[r], header);
    if (filterMatch(obj, filter)) {
      result.push(obj);
    }
  }

  return result;
}

function filterObjects (objs, filter, limit) {
  // Filter a list of objects (objs) and return those that satisfy a filter criteria.
  // if limit is set, return only up to that number of objects
  var i, obj, count = 0,
      objsLength = objs.length,
      result = [];

  for (i = 0; i < objsLength; i++) {
    obj = objs[i];
    if (filterMatch(obj, filter)) {
      result.push(obj);
      count++;
    }
    if (limit && (limit > 0) && (count >= limit)) break;
  }

  return result;
}

// Array helpers

function arrayUnique (array) {
  // Returns new array with unique elements of input array
  return array.filter(function (el, idx, arr) { return arr.indexOf(el) === idx; });
}

function arrayDiff (a1, a2) {
  // Returns new array with elements in a1 but not a2
  return a1.filter(function (el) { return a2.indexOf(el) < 0; });
}

// UI helpers

function requireActiveSheet (sheetOrName, allowContinue) {
  var currentSheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet(),
      requiredSheet = getSheet(sheetOrName),
      ui, msg, response;

  allowContinue = allowContinue || true;
  if (currentSheet.getSheetId() !== requiredSheet.getSheetId()) {
    ui = SpreadsheetApp.getUi();
    msg = Utilities.formatString("Sheet %s must be active in order to continue. Switch?", requiredSheet.getName());
    response = ui.alert(msg, ui.ButtonSet.YES_NO);
    if (response === ui.Button.YES) {
      requiredSheet.activate();
      return allowContinue && true;
    } else {
      ui.alert("Please select required sheet before continuing.");
      return false;
    }
  } else {
    return true;
  }
}

// spreadsheet helpers

function forceAsText (txt) {
  if (txt)
    return "'" + String(txt);
  else
    return "";
}