function test_lastMonth() {
  Logger.log(lastMonth(new Date(2018, 4, 3)).month === 3);
  Logger.log(lastMonth(new Date(2018, 11, 29)).month === 10);
  Logger.log(lastMonth());
}

function test_fixAmount() {
  Logger.log(fixAmount(100444.2355));
}