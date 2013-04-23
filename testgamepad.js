var fs = require('./lib/fs');
var joyMap = require('./lib/joy');
var Fiber = require('fibers');
var streamMap = require('./lib/streammap');

Fiber(function () {
  var fd = fs.$open("/dev/input/js0", "r");
  var fileStream = new fs.ReadStream(fd);
  var joyStream = streamMap(fileStream, joyMap);
  
  var event;
  do {
    event = joyStream.$read();
    console.log(event);
  } while (event);
}).run();

