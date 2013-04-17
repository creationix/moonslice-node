var fs = require('./lib/fs');
var await = require('./lib/await');
var Fiber = require('fibers');


function fib() {
  var a = 0;
  var b = 1;
  return {
    read: function () { return function (callback) {
      var t = a;
      a = b;
      b += t;
      process.nextTick(function () {
        callback(null, t);
      });
    }}
  };
}

var gen = fib();

Fiber(function () {
  var i;
  do {
    i = await(gen.read());
    console.log(i);
  } while (i < 100);
}).run();
