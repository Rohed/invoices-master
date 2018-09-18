var SETTINGS = {
  sheets: {
    invoices: "Invoices",
    contractors: "Contractors"
  },

  fields: {
    contractors: [
      {id: 'email', title: 'Email'},
      {id: 'fullName', title: 'Full name'},
      {id: 'contractDate', title: 'Contract date'},
      {id: 'address1', title: 'Address 1'},
      {id: 'address2', title: 'Address 2'},
      {id: 'country', title: 'Country'},
      {id: 'phone', title: 'Phone number'},
      {id: 'paymentMethod', title: 'Payment method'},
      {id: 'achName', title: 'ACH name on account'},
      {id: 'achAccount', title: 'ACH account number'},
      {id: 'achAccountType', title: 'ACH account type'},
      {id: 'achRoutingNumber', title: 'ACH routing number'},
      {id: 'swiftName', title: 'SWIFT name on account'},
      {id: 'swiftBank', title: 'SWIFT bank name'},
      {id: 'swiftIBAN', title: 'SWIFT account IBAN'},
      {id: 'swiftCode', title: 'SWIFT code'},
      {id: 'paypalEmail', title: 'Paypal account email'},
      {id: 'payoneerAccount', title: 'Payoneer account number'},
      {id: 'approvalStatus', title: 'Approval Status'},
      {id: 'priorityID', title: 'Priority ID'}
    ],
    invoices: [
      {id: 'email', title: 'Email'},
      {id: 'month', title: 'Month of service'},
      {id: 'date', title: 'Date appearing on invoice'},
      {id: 'number', title: 'Invoice number'},
      {id: 'amount', title: 'Invoice amount'},
      {id: 'filename', title: 'Invoice upload'},
      {id: 'approvedStatus', title: 'Approved status'},
      {id: 'paymentStatus', title: 'Payment Status'}
    ]
  },

  paymentMethods: ['ACH', 'SWIFT', 'PayPal', 'Payoneer'],
  achAccountTypes: ['Checking', 'Savings']
};

/// web app entry point
function doGet(e) {
  var index = HtmlService.createTemplateFromFile('index.html');
  return index.evaluate().setTitle("Mindojo Invoices Management");
}

/// check user data
function getUserData(email) {
  var ss = SpreadsheetApp.openById(SYSTEM_SETTINGS.spreadsheet),
      sheet = ss.getSheetByName(SETTINGS.sheets.contractors),
      contractors = filterRows(sheet, {Email: email}),
      contractor;

  if (contractors.length === 0) {
    return {action: 'create-vendor', message: 'Please sign in with Google account and create your invoicing profile.'};
  } else if (contractors.length === 1) {
    contractor = contractors[0];
    if (contractor['Approval Status'] === 'approved') {
      return {action: 'upload-invoice', message: 'You may proceed with uploading invoices.'};
    } else {
      return {action: 'wait', message: 'Your profile status has not yet been approved. Please wait.'};
    }
  } else if (contractors.length > 1) {
    // we could email admin here because something is broken with the data
    // and they need to fix it
    return {action: 'error', message: 'System error: Multiple profiles found. Please wait.'};
  }
}

function blankFields(obj, fields) {
  fields.forEach(function (el) {
    obj[el] = '';
  });
}

function submitNewProfile(profile) {
  var ss = SpreadsheetApp.openById(SYSTEM_SETTINGS.spreadsheet),
      sheet = ss.getSheetByName(SETTINGS.sheets.contractors),
      contractors = filterRows(sheet, {Email: profile.email}),
      obj = {},
      header = getHeader(sheet);

  if (contractors.length === 0) {
    var validation = validateProfile(profile);
    if (isValid(validation)) {
      if (profile.paymentMethod === 'ACH')
        blankFields(profile, ['swiftName', 'swiftBank', 'swiftIBAN', 'swiftCode', 'paypalEmail', 'payoneerAccount']);
      if (profile.paymentMethod === 'SWIFT')
        blankFields(profile, ['achName', 'achAccount', 'achAccountType', 'achRoutingNumber', 'paypalEmail', 'payoneerAccount']);
      if (profile.paymentMethod === 'PayPal')
        blankFields(profile, ['achName', 'achAccount', 'achAccountType', 'achRoutingNumber', 'swiftName', 'swiftBank', 'swiftIBAN', 'swiftCode', 'payoneerAccount']);
      if (profile.paymentMethod === 'Payoneer')
        blankFields(profile, ['achName', 'achAccount', 'achAccountType', 'achRoutingNumber', 'swiftName', 'swiftBank', 'swiftIBAN', 'swiftCode', 'paypalEmail']);

      SETTINGS.fields.contractors.forEach(function(field) { obj[field.title] = profile[field.id]; });
      obj['ACH routing number'] = forceAsText(obj['ACH routing number']);
      obj['ACH account number'] = forceAsText(obj['ACH account number']);

      obj.Timestamp = new Date();

      sheet.appendRow(makeRowFromObject(obj, header));

      return {action: 'ok', message: 'Invoicing profile created, please wait for approval.', errors: isValid};
    } else {
      return {action: 'error', message: 'Please fix the errors.', errors: validation};
    }
  } else {
    return {action: 'error', message: 'Profile already exists. Aborting.'};
  }
}

function submitInvoice(fileContent, invoice) {
  var folder = DriveApp.getFolderById(SYSTEM_SETTINGS.folderSubmittedInvoices),
      contentType = fileContent.substring(5, fileContent.indexOf(';')),
      bytes = Utilities.base64Decode(fileContent.substr(fileContent.indexOf('base64,')+7)),
      blob,
      file,
      filename,
      obj = {},
      timestamp = new Date().toUTCString(),
      spreadsheet = SpreadsheetApp.openById(SYSTEM_SETTINGS.spreadsheet),
      contractorsSheet = spreadsheet.getSheetByName(SETTINGS.sheets.contractors),
      contractors = filterRows(contractorsSheet, {Email: invoice.email}),
      contractor,
      invoicesSheet = spreadsheet.getSheetByName(SETTINGS.sheets.invoices),
      header = getHeader(invoicesSheet);

  if (contractors.length === 0) {
    return {error: 'error', message: 'System error. Profile info not found.'};
  } else if (contractors.length === 1) {
    contractor = contractors[0];
    if (contractor['Approval Status'] === 'approved') {
      splitMonth = invoice.month.split('/');
      filename = Utilities.formatString(
        '%s_%s_invoice_%s.pdf',
        contractor['Full name'],
        Utilities.formatString('%s-%s', splitMonth[1], splitMonth[0]),
        invoice.number);
      blob = Utilities.newBlob(bytes, contentType, filename);

      validation = validateInvoice(invoice, blob, invoicesSheet);
      if (isValid(validation)) {
        file = folder.createFile(blob);

        SETTINGS.fields.invoices.forEach(function(field) { obj[field.title] = invoice[field.id]; });
        obj['Month of service'] = forceAsText(obj['Month of service']);
        obj['Invoice number'] = forceAsText(obj['Invoice number']);
        obj['Invoice upload'] = Utilities.formatString('=HYPERLINK("%s", "%s")', file.getUrl(), filename);

        obj.Timestamp = new Date();

        invoicesSheet.appendRow(makeRowFromObject(obj, header));

        return {action: 'ok', message: 'Invoice has been successfuly uploaded.'};
      } else {
        return {action: 'error', message: 'Please fix the errors.', errors: validation};
      }
    } else {
      return {action: 'error', message: 'Your invoicing status has not yet been approved. Please wait.'};
    }
  } else if (contractors.length > 1) {
    // we could email admin here because something is broken with the data
    // and they need to fix it
    return {action: 'error', message: 'System error: Multiple profiles found. Please wait.'};
  }
}

function getInvoiceDateAllowedMonths () {
  return getLast3Months(new Date());
}