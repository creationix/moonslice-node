var Fiber = require('fibers');
module.exports = await;
function await(continuation) {
  var fiber = Fiber.current;
  var result;
  var async;
  continuation(function (err, value) {
    if (async === undefined) {
      async = false;
      result = value;
      if (err) { throw err; }
      return;
    }
    console.log("...resuming fiber");
    if (err) fiber.throwInto(err);
    else fiber.run(value);
  });
  if (async === undefined) {
    async = true;
    console.log("Pausing fiber...");
    return Fiber.yield();
  }
  return result;
}
