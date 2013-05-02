var tcp = require('./lib/tcp');
var helpers = require('./testhelpers');

// A silly app that echos objects and warns on other inputs.
// Implemented as an (emit -> emit) push filter
var app = function (emit) {
  emit(null, "Welcome");
  return function (err, item) {
    if (item === undefined) {
      if (err) {
        // Forward parsing errors to the user as a message.
        return emit(null, ["Parse Error", err.input, err.toString()]);
      }
      // Forward end events
      return emit();
    }
    if (item && typeof item === "object") {
      emit(null, item);
    }
    else {
      emit(null, ["Not Object", item]);
    }
  };
};

// We want all messages in and out of the app to be
// Line-delimited and JSON serialized
// So let's combine all the pushFilters into one composite filter
// combinePush is ([(emit -> emit)*] -> (emit -> emit))
app = helpers.combinePush([
  helpers.lineDecode,
    helpers.mapToPush(JSON.parse, "JSON.parse"),
      app,
    helpers.mapToPush(JSON.stringify, "JSON.stringify"),
  helpers.lineEncode
]);

// Now we need this combined push filter as a pull filter
// pushToPull is ((emit -> emit) -> (read -> read))
app = helpers.pushToPull(app);

// Hook the app to a TCP server
var server = tcp.createServer("0.0.0.0", 3000, function (socket) {
  socket.sink(       // Stream consumer  (read)
    app(             // Stream filter    (read -> read)
      socket.source  // Stream source     read
    )
  );
});

console.log("TCP echo server listening at", server.getsockname());

