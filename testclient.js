var tcp = require('./lib/tcp');
var helpers = require('./testhelpers');
var readline = require('readline');

var host = process.argv[2];
var port = parseInt(process.argv[3], 10);

if (!host || !port) {
  console.error("USE: `node " + process.argv[1] + " <host> <port>`");
  process.exit(1);
}

// Build pull versions of the line codecs
var lineDecode = helpers.pushToPull(helpers.lineDecode);
var lineEncode = helpers.pushToPull(helpers.lineEncode);

console.log("Connecting...");
var client = tcp.connect(host, port, function (err, socket) {
  if (err) throw err;
  var repl = makeRepl("Connected");

  // Pipe the socket and the repl together
  repl.sink(lineDecode(socket.source));
  socket.sink(lineEncode(repl.source));
});

function makeRepl(welcome) {
  var red = '\033[31m';
  var green = '\033[32m';
  var blue = '\033[34m';
  var plain = '\033[39m';
  var pipe = helpers.makePipe();

  function print(msg, color) {
    if (color) {
      msg = color + msg + plain;
    }
    return process.stdout.write('\033[2K\033[E' + msg + '\n');
  }

  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.on('close', function () {
    pipe.emit();
  });

  rl.on('line', function (message) {
    pipe.emit(null, message);
    rl.prompt();
  });

  rl.prompt();

  print(welcome, green);

  function onData(err, item) {
    if (item === undefined) {
      if (err) {
        print(err.stack, red);
      }
      else {
        print("Closing...", green);
      }
      process.exit(err ? -1 : 0);
    }
    else {
      print("< " + item, blue);
      rl.prompt();
    }
  }
  return {
    source: pipe.read,
    sink: function (read) {
      helpers.consume(read, onData);
    }
  };
}

