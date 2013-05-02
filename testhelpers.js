// Accepts a map function, return a push-filter function.
exports.mapToPush = mapToPush;
function mapToPush(map) {
  return function (emit) {
    return function (err, item) {
      if (item === undefined) return emit(err);
      var mapped;
      try {
        mapped = map(item);
      }
      catch (err) {
        err.input = item;
        return emit(err);
      }
      emit(null, mapped);
    };
  };
}

// Accepts a map function, returns a pull-filter function
exports.mapToPull = mapToPull;
function mapToPull(map) {
  return function (read) {
    return function (close, callback) {
      if (close) return read(close);
      read(null, function (err, item) {
        if (item === undefined) return callback(err);
        var mapped;
        try {
          mapped = map(item);
        }
        catch (err) {
          return callback(err);
        }
        callback(null, mapped);
      });
    };
  };
}

// Combine a list of pushFilters returning a composite pushFilter
exports.combinePush = combinePush;
function combinePush(pushFilters) {
  return function (emit) {
    var i = pushFilters.length;
    while (i--) {
      emit = pushFilters[i](emit);
    }
    return emit;
  };
}

// Accepts a push filter and returns a pull filter.
// Adds in back-pressure and close propagation
// ((emit -> emit) -> (read -> read))
exports.pushToPull = pushToPull;
function pushToPull(pushFilter) {
  return function (read) {
    var dataQueue = [];
    var readQueue = [];
    var write = pushFilter(function () {
      dataQueue.push(arguments);
    });
    var reading;
    function check() {
      while (dataQueue.length && readQueue.length) {
        readQueue.shift().apply(null, dataQueue.shift());
      }
      if (!reading && readQueue.length) {
        reading = true;
        read(null, onRead);
      }
    }
    function onRead(err, item) {
      reading = false;
      write(err, item);
      check();
    }
    return function (close, callback) {
      // Forward close events throguh
      if (close) return read(close, callback);
      readQueue.push(callback);
      check();
    };
  };
}

// A push filter that parses newline delimited text streams.
// input Buffer chunks
// output line strings
exports.lineDecode = lineDecode;
function lineDecode(emit) {
  var message = "";
  return function (err, item) {
    if (item === undefined) return emit(err);
    for (var i = 0, l = item.length; i < l; i++) {
      var byte = item[i];
      if (byte !== 0x0d && byte !== 0x0a) {
        message += String.fromCharCode(byte);
        continue;
      }
      // At this point message is utf8 encoded, but we want native javascript
      // strings, so we need to convert and emit.
      if (message) {
        emit(null, decodeURIComponent(escape(message)));
        message = "";
      }
    }
  };
}

// A push filter that newline encodes messages
// input: items
// output: items with newline
exports.lineEncode = lineEncode;
function lineEncode(emit) {
  return function (err, item) {
    if (item === undefined) return emit(err);
    emit(null, item);
    emit(null, "\n");
  };
}

// Consume a read stream and emit
// NOTE: breaks back-pressure
exports.consume = consume;
function consume(read, emit) {
  var close;
  var sync;
  start();
  function start() {
    do {
      sync = undefined;
      read(close, onRead);
      if (sync === undefined) sync = false;
    } while (sync);
  }
  function onRead(err, item) {
    emit(err, item);
    if (sync === undefined) {
      sync = true;
    }
    else {
      start();
    }
  }
}
// Make a pipe where writes to one end can be read from the other end.
// NOTE: breaks back-pressure
exports.makePipe = makePipe;
function makePipe() {
  var dataQueue = [];
  var readQueue = [];

  function check() {
    while (dataQueue.length && readQueue.length) {
      readQueue.shift().apply(null, dataQueue.shift());
    }
  }

  function emit() {
    dataQueue.push(arguments);
    check();
  }

  function read(close, callback) {
    if (close) return callback();
    readQueue.push(callback);
    check();
  }

  return { read: read, emit: emit };
}

// Pull-filter that traces
exports.trace = trace;
function trace(label, read) {
  return function (close, callback) {
    if (close) return read(close, callback);
    read(close, function(err, item) {
      console.log(Date.now().toString(36), label, Array.prototype.slice.call(arguments));
      callback(err, item);
    });
  };
}

// Pull-filter that waits for a number of ms before emitting the value.
// Simulates a slow link in a network
exports.delay = delay;
function delay(ms, read) {
  return function (close, callback) {
    read(close, function (err, item) {
      setTimeout(function () {
        callback(err, item);
      }, ms);
    });
  };
}

