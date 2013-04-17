var fs = require('./lib/fs');
var Fiber = require('fibers');
var $wait = require('./lib/await');
var runOnce = require('uvrun').runOnce;

// Consume all data in a readable stream not using $wait, but returning a continuable.
// Uses a do..while internally so as to not stack overflow on sync callbacks.
function buffer(readable) {
  return function (callback) {
    var sync, parts = [];
    function read() {
      do {
        sync = undefined;
        readable.read()(onRead);
      } while (sync);
      sync = false;
    }
    function onRead(err, data) {
      if (err) return callback(err);
      if (!data) return callback(null, parts);
      parts.push(data);
      if (sync === undefined) { sync = true; }
      else { read(); }
    }
    read();
  };
}

function pipe(readable, writable) {
  return function (callback) {
    var sync;
    function read() {
      do {
        sync = undefined;
        readable.read()(onRead);
      } while(sync);
      sync = false;
    }
    function onRead(err, data) {
      if (err) return callback(err);
      if (data) { writable.write(data)(onWrite); }
      else { writable.write(data)(callback); }
    }
    function onWrite(err) {
      if (err) return callback(err);
      if (sync === undefined) { sync = true; }
      else { read(); }
    }
  };
}

// Consume all data in a readable stream using $wait
function $buffer(readable) {
  var chunk, parts = [];
  while (chunk = readable.$read()) {
    parts.push(chunk);
  }
  return parts;
}

// Piping from a redable stream to a writable stream using $wait
function $pipe(readable, writable) {
  var chunk;
  do {
    chunk = readable.$read();
    writable.$write(chunk);
  } while(chunk);
}

function readFile(path) {
  return function (callback) {
    fs.open(path, "r")(function (err, fd) {
      if (err) return callback(err);
      buffer(new fs.ReadStream(fd))(callback);
    });
  };
}

function $readFile(path) {
  var fd = fs.$open(path, "r");
  var readable = new fs.ReadStream(fd);
  return $buffer(readable);
}

function writeFile(path, data) {
  return function (callback) {
    fs.open(path, "w")(function(err, fd) {
      if (err) return callback(err);
      var writable = new fs.WriteStream(fd);
      writable.write(data)(function (err) {
        if (err) return callback(err);
        writable.write()(callback);
      });
    });
  };
}

function $writeFile(path, data) {
  var writable = new fs.WriteStream(fs.$open(path, "w"));
  writable.$write(data);
  writable.$write();
}

// A buffering copyFile
function copyFile(from, to) {
  return function (callback) {
    readFile(from)(function (err, data) {
      if (err) return callback(err);
      writeFile(to, data)(callback);
    });
  };
}

// A buffering copyFile
function $copyFile(from, to) {
  $writeFile(to, $readFile(from));
}

function streamCopy(from, to) {
  return function (callback) {
    fs.open(from, "r")(function (err, fd) {
      if (err) return callback(err);
      var readable = new fs.ReadStream(fd);
      fs.open(to, "w")(function (err, fd) {
        if (err) return callback(err);
        var writable = new fs.WriteStream(fd);
        pipe(readable, writable)(callback);
      });
    });
  };
}

function $streamCopy(from, to) {
  var readable = new fs.ReadStream(fs.$open(from, "r"));
  var writable = new fs.WriteStream(fs.$open(to, "w"));
  $pipe(readable, writable);
}

Fiber(function () {
  console.log("\nInline read using two awaits");
  var fd = $wait(fs.open("config.json", "r"));
  var readable = new fs.ReadStream(fd);
  var body = $wait(buffer(readable));
  console.log(body);

  console.log("\nAs a one-liner");
  body = $wait(buffer(new fs.ReadStream($wait(fs.open("config.json", "r")))));
  console.log(body);
  
  console.log("\nUsing $buffer helper and fs.$open");
  body = $buffer(new fs.ReadStream(fs.$open("config.json", "r")));
  console.log(body);

  console.log("\nUsing readFile helper and one $wait");
  body = $wait(readFile("config.json"));
  console.log(body);
  
  console.log("\nUsing $readFile helper");
  body = $readFile("config.json");
  console.log(body);
  
  console.log("\nBuffering copy using only a single $wait");
  $wait(copyFile("config.json", "config.bak"));
  
  

}).run();

// Visualize each event loop tick using a custom event loop.
console.log("Waiting for events...");
do {
  var ret = runOnce();
  console.log("tick", Date.now());
} while(ret);
