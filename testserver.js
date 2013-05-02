var arr = function (val) {
  return Array.prototype.slice.call(val);
};
var tcp = require('./lib/tcp');

// A silly app that echos objects and warns on other inputs.
// Implemented as an (emit -> emit) push filter
var app = function (emit) {
  return function (err, item) {
    console.log("app", arr(arguments));
    if (item === undefined) {
      if (err) {
        // Forward parsing errors to the user as a message.
        return emit(null, ["I couldn't understand you", err.input, err.toString()]);
      }
      // Forward end events
      return emit();
    }
    if (item && typeof item === "object") {
      emit(null, item);
    }
    else {
      emit(null, ["I only accept objects, but you gave me", item]);
    }
  };
};

// We want all messages in and out of the app to be
// Line-delimited and JSON serialized
// So let's combine all the pushFilters into one composite filter
// combinePush is ([(emit -> emit)*] -> (emit -> emit))
app = combinePush([
  lineDecode,
    mapToPush(JSON.parse, "JSON.parse"),
      app,
    mapToPush(JSON.stringify, "JSON.stringify"),
  lineEncode
]);

// Now we need this combined push filter as a pull filter
// pushToPull is ((emit -> emit) -> (read -> read))
app = pushToPull(app);

// Hook the app to a TCP server
var server = tcp.createServer("0.0.0.0", 3000, function (source, sink) {
  sink(       // Stream consumer  (read)
    app(      // Stream filter    (read -> read)
      source  // Stream source     read
    )
  );
});

console.log("TCP echo server listening at", server.getsockname());

// Accepts a map function, return a push-filter function.
function mapToPush(map, name) {
  return function (emit) {
    return function (err, item) {
      console.log(name || "mapToPush", arr(arguments));
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
function mapToPull(map) {
  return function (read) {
    return function (close, callback) {
      if (close) return read(close);
      read(null, function (err, item) {
        if (item === undefined) return callback(err);
        callback(null, map(item));
      });
    };
  };
}

// Combine a list of pushFilters returning a composite pushFilter
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
function pushToPull(pushFilter) {
  return function (read) {
    var dataQueue = [];
    var readQueue = [];
    var write = pushFilter(function () {
      console.log("combined", arr(arguments));
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
function lineDecode(emit) {
  var message = "";
  return function (err, item) {
    console.log("lineDecode", arr(arguments));
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
function lineEncode(emit) {
  return function (err, item) {
    console.log("lineEncode", arr(arguments));
    if (item === undefined) return emit(err);
    emit(null, item);
    emit(null, "\n");
  };
}

