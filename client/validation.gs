/// given validationObject, returns true or false
function isValid(validationObject) {
  return Object.keys(validationObject).length === 0;
}

function msgLength(length) {
  return Utilities.formatString('Must be up to %d characters including white space', length);
}

function msgEmpty() {
  return 'Must not be blank.';
}

function msgReducedAscii() {
  return 'Must contain only letters, digits, space or / - . ,';
}

function isBlank(s) {
  return s === '';
}

function isEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function isAmount(s) {
  return /^\d+(\.\d{1,2})?$/.test(s);
}

/// parses month/year in mm/yyyy format
function parseMonth(m) {
  var s = m.split('/');
  return {year: parseInt(s[1], 10), month: parseInt(s[0], 10)};
}

/// parses date in mm/dd/yyyy format
function parseDate(d) {
  var s = d.split('/');
  return {year: parseInt(s[2], 10), month: parseInt(s[0], 10), day: parseInt(s[1], 10)};
};

function isDate(s) {
  var p = parseDate(s),
      d = new Date(p.year, p.month-1, p.day);
  return (d.getFullYear() === p.year) && (d.getMonth() === p.month-1) && (d.getDate() === p.day);
}

/// returns a date from string in mm/dd/yyyy format
function strToDate(d) {
  var p = parseDate(d);

  return new Date(p.year, p.month-1, p.day);
}

/// returns true if input contains only valid characters
function isReducedAscii(s) {
  var validChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-., ".split(""),
      result = true;
  s.split("").forEach(function(char) {
    result = result && (validChars.indexOf(char) > -1);
  });
  return result;
}

/// returns validation object, each key is prop name and its value is error message
/// when this validation object is passed to isValid, it return
function validateProfile(profile) {
  var result = {}, cd;

  if (isBlank(profile.email)) result.email = msgEmpty();
  if (!isEmail(profile.email)) result.email = 'Must be a valid email address';

  if (isBlank(profile.fullName)) result.fullName = msgEmpty();
  if (profile.fullName.length > 22) result.fullName = msgLength(22);

  if (isBlank(profile.contractDate)) result.contractDate = msgEmpty();
  if (!isDate(profile.contractDate)) result.contractDate = 'Must be a valid date in mm/dd/yyyy format.';
  cd = strToDate(profile.contractDate);
  cd.setHours(23); cd.setMinutes(59); cd.setSeconds(59);
  if (cd >= new Date()) result.contractDate = 'Contract date must be in the past.';

  if (isBlank(profile.address1)) result.address = msgEmpty();
  if ((profile.address1.length > 35) || (profile.address2.length > 35))
    result.address = 'Each address line must not exceed 35 characters.';

  if (isBlank(profile.phone)) result.phone = msgEmpty();
  if (profile.phone.length > 16) result.phone = msgLength(16);

  if (SETTINGS.paymentMethods.indexOf(profile.paymentMethod) === -1) {
    result.paymentMethod = Utilities.formatString(
      'Payment method must be one of the following: %s',
      SETTINGS.paymentMethods.join(', ')
    );
  }

  // validate ACH fields
  if (profile.paymentMethod === 'ACH') {
    if (isBlank(profile.achName)) result.achName = msgEmpty();
    if (!isReducedAscii(profile.achName)) result.achName = msgReducedAscii();

    if (isBlank(profile.achAccount)) result.achAccount = msgEmpty();
    if (!/^\d+$/.test(profile.achAccount)) result.achAccount = 'Must be digits only.';

    if (profile.achName.length > 16) result.achName = msgLength(16);
    if (SETTINGS.achAccountTypes.indexOf(profile.achAccountType) === -1) {
      result.achAccountType = Utilities.formatString(
        'ACH account type must be one of the following: %s',
        SETTINGS.achAccountTypes.join(', ')
      );
    }
    if (isBlank(profile.achRoutingNumber)) result.achRoutingNumber = msgEmpty();
    if (!/^\d{9}$/.test(profile.achRoutingNumber)) result.achRoutingNumber = 'Must be 9 digits';
  }

  // validate SWIFT fields
  if (profile.paymentMethod === 'SWIFT') {
    if (isBlank(profile.swiftName)) result.swiftName = msgEmpty();
    if (!isReducedAscii(profile.swiftName)) result.swiftName = msgReducedAscii();
    if (profile.swiftName.length > 35) result.swiftName = msgLength(35);

    if (profile.swiftBank.length > 35) result.swiftBank = msgLength(35);
    if (!isReducedAscii(profile.swiftBank)) result.swiftBank = msgReducedAscii();

    if (!/^([a-zA-Z]{2}[0-9]{2}[a-zA-Z0-9]{4})?[0-9]{7}([a-zA-Z0-9]?){0,16}$/.test(profile.swiftIBAN))
      result.swiftIBAN = 'IBAN does not appear to be correct.';

    if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(profile.swiftCode))
      result.swiftCode = 'Swift code does not appear to be correct.';
  }

  if (profile.paymentMethod === 'PayPal') {
    if (isBlank(profile.paypalEmail)) result.paypalEmail = msgEmpty();
    if (!isEmail(profile.paypalEmail)) result.paypalEmail = 'Must be a valid email address';
  }

  if (profile.paymentMethod === 'Payoneer') {
    if (isBlank(profile.payoneerAccount)) result.payoneerAccount = msgEmpty();
    if (!/^\d{9,}$/.test(profile.payoneerAccount)) result.payoneerAccount = 'Must be 9 digits or more';
  }

  return result;
}

function getLast3Months(date) {
  var result = [],
      formatMonth = function (d) {
        return Utilities.formatDate(d, 'GMT', 'MM/yyyy');
      },
      ms = date.getTime(), tmpDate;

  // we need this month
  result.push(formatMonth(date));

  // and last 3, making total of 4
  while (result.length < 4) {
    ms = ms - 1000 * 60 * 60 * 24 * 7; // 7 days in miliseconds
    tmpDate = new Date(ms);
    if (result.indexOf(formatMonth(tmpDate)) === -1) result.push(formatMonth(tmpDate));
  }

  return result;
}

/// validates invoice objects, returns a validation object that
/// can be passed to isValid
function validateInvoice(invoice, blob, sheet) {
  var result = {},
      currentDate = new Date(),
      existingInvoices;

  if (isBlank(invoice.month)) result.month = msgEmpty();
  if (getLast3Months(currentDate).indexOf(invoice.month) === -1) result.month = 'Month must be this month or one of recent three.';

  existingInvoices = filterRows(sheet, {Email: invoice.email, 'Month of service': invoice.month});
  if (existingInvoices.length > 0) result.month = 'You have already submitted an invoice for this month.';

  if (isBlank(invoice.date)) result.date = msgEmpty();
  if (parseMonth(invoice.month).year !== parseDate(invoice.date).year
    || parseMonth(invoice.month).month !== parseDate(invoice.date).month) {

    result.date = Utilities.formatString('Date must be within entered month (%s).', invoice.month);
  }

  if (isBlank(invoice.number)) result.number = msgEmpty();
  if (invoice.number.length > 10) result.number = msgLength(10);

  if (isBlank(invoice.amount)) result.amount = msgEmpty();
  if (!isAmount(invoice.amount)) result.amount = 'Amount is not valid, please enter a number with maximum 2 decimal places.';

  if (blob.getContentType() !== 'application/pdf') result.file = 'Uploaded file must be PDF.';
  if (blob.getBytes().length > 200 * 1024) result.file = 'Invoices should be up to 200kB';

  return result;
}
