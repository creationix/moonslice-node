var tcp = require('./lib/tcp');
var Fiber = require('fibers');

var server = tcp.createServer("0.0.0.0", 3000, function (client) {
  Fiber(function () {
    var chunk;
    console.log("Writing greeting");
    client.$write("Welcome to the echo server.\r\n");
    do {
      // console.log("Reading data");
      chunk = client.$read();
      // console.log("read", chunk);
      // console.log("writing data...");
      client.$write(chunk);
      // console.log("written.");
    } while (chunk !== undefined);
  }).run();
});
console.log("TCP echo server listening at", server.getsockname());