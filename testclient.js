var tcp = require('./lib/tcp');
var helpers = require('./testhelpers');
var readline = require('readline');
var inspect = require('util').inspect;

var host = process.argv[2];
var port = parseInt(process.argv[3], 10);

if (!host || !port) {
  console.error("USE: `node " + process.argv[1] + " <host> <port>`");
  process.exit(1);
}

// Build pull versions of the line codecs
var lineDecode = helpers.pushToPull(helpers.lineDecode);
var lineEncode = helpers.pushToPull(helpers.lineEncode);
var jsonToInspect = helpers.mapToPull(function (item) {
  return inspect(JSON.parse(item), {colors:true});
});

console.log("Connecting...");
var client = tcp.connect(host, port, function (err, socket) {
  if (err) throw err;
  var repl = makeRepl();
  repl.print("Connected", "green");

  var jsToJson = helpers.mapToPull(function (item) {
    try {
      return JSON.stringify(eval("(" + item + ")"));
    }
    catch (err) {
      repl.print(err.stack, "red");
      return "";
    }
  });
  // Pipe the socket and the repl together
  repl.sink(jsonToInspect(lineDecode(socket.source)));
  socket.sink(lineEncode(jsToJson(repl.source)));
});

function makeRepl() {
  var colors = {
    red: '\033[31m',
    green: '\033[32m',
    yellow: '\033[33m',
    blue: '\033[34m',
    plain: '\033[39m'
  };
  var pipe = helpers.makePipe();

  function print(msg, color) {
    if (color) {
      msg = colors[color] + msg + colors.plain;
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

  function onData(err, item) {
    if (item === undefined) {
      if (err) {
        print(err.stack, "red");
      }
      else {
        print("Closing...", "green");
      }
      process.exit(err ? -1 : 0);
    }
    else {
      print("< " + item);
      rl.prompt();
    }
  }
  return {
    source: pipe.read,
    sink: function (read) {
      helpers.consume(read, onData);
    },
    print: print
  };
}

