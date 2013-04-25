var tcp = require('./lib/tcp');
var streamMap = require('./lib/streammap');
var Fiber = require('fibers');
var http = require('./lib/http');

var server = tcp.createServer("0.0.0.0", 3000, function (tcpStream) {
  var httpStream = streamMap(tcpStream, http);

  Fiber(function () {
    var request;
    while (request = httpStream.$read()) {
      Fiber(function () {
        var response = http.$normalize(app(request));
        httpStream.$write(http.finalize(response));
      }).run();
    }
  }).run();
});
console.log("HTTP server listening at", server.getsockname());

function app(request) {
  console.log(request.method, request.url);  
  return "Hello World\n";
}