function test_getLast3Months() {
  Logger.log(getLast3Months(new Date()));
}

function test_isDate() {
  Logger.log(isDate('01/01/2018')); //true
  Logger.log(isDate('02/29/2018')); //false
}

function test_strToDate() {
  Logger.log(strToDate('03/14/2018'));
}

function test_isReducedAscii() {
  Logger.log(isReducedAscii('abc1834/')); // true
  Logger.log(isReducedAscii('a BCD 432 / - . , ')); // true
  Logger.log(isReducedAscii('?')); // false
}