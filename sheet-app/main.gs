var SETTINGS = {
  sheets: {
    contractors: 'Contractors',
    invoices: 'Invoices'
  }
};

function onOpen() {
  var ui = SpreadsheetApp.getUi();

  ui.createMenu('Export')
    .addItem('Export ACH', 'exportACH')
    .addItem('Export SWIFT', 'exportSWIFT')
    .addItem('Export Priority', 'exportPriority')
    .addSeparator()
    .addItem('Check Approved Contractors without Priority ID (sends email)', 'checkApprovedContractors')
    .addToUi();
}

function showFile(file) {
  var ui = SpreadsheetApp.getUi();
  ui.alert('Create file URL', file.getUrl(), ui.ButtonSet.OK);
}

function getMonthName(month) {
  var months = [
    'Jan', 'Feb', 'Mar', 'Apr',
    'May', 'Jun', 'Jul', 'Aug',
    'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return months[month-1];
}

function lastMonth(currentDate) {
  if (!currentDate) currentDate = new Date();
  var ms = currentDate.getTime();

  while (currentDate.getMonth() === (new Date(ms)).getMonth()) {
    ms = ms - 1000 * 60 * 60 * 24 * 7; // 7 days in miliseconds
  }
  return {year: new Date(ms).getFullYear(), month: new Date(ms).getMonth()+1};
}

/// double quote a string
function quote(s) {
  return '"' + s + '"';
}

/// fix amount formatting to exactly 2 decimal places
function fixAmount(n) {
  return parseFloat(n).toFixed(2);
}

/// comparer function that compares two objects on the value of field attribute
function sortOnField(field) {
  var comparer = function (a, b) {
    if (a[field] < b[field]) {
      return -1;
    } else if (a[field] === b[field]) {
      return 0;
    } else
      return 1;
  }

  return comparer;
}

function saveFile(foldername, filename, content) {
  var folder = DriveApp.getFolderById(foldername),
      file = folder.createFile(filename, content);
  showFile(file);
}

function exportACH() {
  var cons = filterRows(getSheet(SETTINGS.sheets.contractors), {'Payment method': 'ACH'}),
      invs = filterRows(getSheet(SETTINGS.sheets.invoices), {'Approved status': 'approved', 'Payment Status': ''}),
      report = [], allItems = [];

  invs.forEach(function (el) {
    var accountCode;
    var con = filterObjects(cons, {Email: el.Email}, 1)[0];

    if (con && (con['Payment method'] === 'ACH')) {
      if (con['ACH account type'] === 'Checking') accountCode = 22;
      if (con['ACH account type'] === 'Savings') accountCode = 32;
      report.push({
        account_code: accountCode,
        routing_number: quote(con['ACH routing number']),
        account_number: quote(con['ACH account number']),
        amount: el['Invoice amount'],
        reserved: '',
        ach_name: quote(con['ACH name on account']),
        ach_account_type: quote(con['ACH account type'])
      });
    }
  });

  report.sort(sortOnField('ach_name'));

  report.forEach(function(el) {
    allItems.push([
      el.account_code,
      el.routing_number,
      el.account_number,
      el.amount,
      el.reserved,
      el.ach_name, 
      el.ach_account_type
    ].join(','));
  });

  saveFile(
    SYSTEM_SETTINGS.folders.bankExports,
    Utilities.formatString('%d-%s_ACH.csv', lastMonth().year, padLeft(lastMonth().month, 2, '0')),
    allItems.join('\n')
  );
}

function exportSWIFT() {
  var cons = filterRows(getSheet(SETTINGS.sheets.contractors), {'Payment method': 'SWIFT'}),
      invs = filterRows(getSheet(SETTINGS.sheets.invoices), {'Approved status': 'approved', 'Payment Status': ''}),
      report = [], allItems = [],
      getTemplate = function() {
        var template = '';

        template += '{1:F01LUMIUS3NAXXX0000000000}{2:I103___swift-code___}{4:\n';
        template += ':20:INVOICE ___month___ ___year___\n';
        template += ':23B:CRED\n';
        template += ':32A:180321USD___amount_before_decimal___,___amount_after_decimal___\n';
        template += ':50K:/12345678\n';
        template += 'Mindojo Ltd\n';
        template += 'Street\n';
        template += 'New York NY\n';
        template += 'USA\n';
        template += ':57D://SW/___swift-code___\n';
        template += '___bank___\n';
        template += ':59:/___iban___\n';
        template += '___full_name___\n';
        template += '___address1___\n___address2___';
        template += ':71A:OUR\n';
        template += '-}\n';
        return template;
      };

  invs.forEach(function (el) {
    var con = filterObjects(cons, {Email: el.Email}, 1)[0],
        my, amount;

    if (con && (con['Payment method'] === 'SWIFT')) {
      my = el['Month of service'].split('/');
      amount = el['Invoice amount'].toFixed(2);

      report.push({
        month: getMonthName(my[0]),
        year: my[1],
        amount_before_decimal: amount.split('.')[0],
        amount_after_decimal: amount.split('.')[1],
        swift_code: con['SWIFT code'],
        bank: con['SWIFT bank name'],
        iban: con['SWIFT account IBAN'],
        full_name: con['Full name'],
        address1: con['Address 1'],
        address2: con['Address 2']
      });
    }
  });

  report.sort(sortOnField('full_name'));

  report.forEach(function (el) {
    var item = getTemplate();
    item = item.replace('___month___', el.month);
    item = item.replace('___year___', el.year);
    item = item.replace('___amount_before_decimal___', el.amount_before_decimal);
    item = item.replace('___amount_after_decimal___', el.amount_after_decimal);
    item = item.replace(/___swift-code___/g, el.swift_code);
    item = item.replace('___bank___', el.bank);
    item = item.replace('___iban___', el.iban);
    item = item.replace('___full_name___', el.full_name);
    item = item.replace('___address1___', el.address1);
    if (el.address2) {
      item = item.replace('___address2___', Utilities.formatString('%s\n', el.address2));
    } else {
      item = item.replace('___address2___', '');
    }

    allItems.push(item);
  });

  saveFile(
    SYSTEM_SETTINGS.folders.bankExports,
    Utilities.formatString('%d-%s_SWIFT.txt', lastMonth().year, padLeft(lastMonth().month, 2, '0')),
    allItems.join('')
  );
}

function exportPriority() {
  var cons = filterRows(getSheet(SETTINGS.sheets.contractors), {}),
      invs = filterRows(getSheet(SETTINGS.sheets.invoices), {'Approved status': 'approved', 'Payment Status': ''}),
      report = [], allItems = [];

  invs.forEach(function (el) {
    var con = filterObjects(cons, {Email: el.Email}, 1)[0],
        date = new Date(el['Date appearing on invoice']);

    if (con) {
      report.push({
        priority_id: con['Priority ID'],
        invoice_number: el['Invoice number'],
        invoice_date: Utilities.formatDate(date, 'UTC', 'dd/MM/yyyy'),
        amount: fixAmount(el['Invoice amount']),
        currency: 'USD',
        full_name: quote(con['Full name']),
        month: el['Month of service']
      });
    }
  });
  
  report.sort(sortOnField('full_name'));

  report.forEach(function (el) {
    allItems.push([
      el.priority_id,
      el.invoice_number,
      el.invoice_date,
      el.amount,
      el.currency,
      el.full_name, 
      el.month
    ].join('\t'));
  });

  saveFile(
    SYSTEM_SETTINGS.folders.invoiceExports,
    Utilities.formatString('%d-%s_invoices.tsv', lastMonth().year, padLeft(lastMonth().month, 2, '0')),
    allItems.join('\n')
  );
}

function checkApprovedContractors() {
  var spreadsheet = SpreadsheetApp.getActive(),
      sheet = spreadsheet.getSheetByName(SETTINGS.sheets.contractors),
      count = 0,
      subject, body, options = {},
      url = spreadsheet.getUrl();

  processRange(sheet.getDataRange(), function(obj) {
    if ((obj['Approval Status'] === 'approved') && (!obj['Priority ID'])) {
      count++;
    }
  });

  if (count > 0) {
    subject = Utilities.formatString('%d missing Priority ID(s)!', count);
    body = url;
    options.htmlBody = Utilities.formatString('<p><a href="%s">%s</a></p>', url, url);
    GmailApp.sendEmail(spreadsheet.getOwner().getEmail(), subject, body, options);
  }
}
