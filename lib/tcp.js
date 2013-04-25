var TCP = process.binding('tcp_wrap').TCP;
var Stream = require('./stream');
var Fiber, $wait;
try {
  Fiber = require('fibers');
  $wait = require('./await');
}
catch (err) {
  // fiber-based methods won't work.
}

function noop() {}

function createWriteReq(handle, data, encoding) {
  switch (encoding) {
    case 'buffer':
      return handle.writeBuffer(data);

    case 'utf8':
    case 'utf-8':
      return handle.writeUtf8String(data);

    case 'ascii':
      return handle.writeAsciiString(data);

    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return handle.writeUcs2String(data);

    default:
      return handle.writeBuffer(new Buffer(data, encoding));
  }
}


function errnoException(errorno, syscall) {
  // TODO make this more compatible with ErrnoException from src/node.cc
  // Once all of Node is using this function the ErrnoException from
  // src/node.cc should be removed.
  var e = new Error(syscall + ' ' + errorno);
  e.errno = e.code = errorno;
  e.syscall = syscall;
  console.log("ERR", e);
  return e;
}

function afterWrite(status, handle, req) {
  if (status) {
    return req.cb(errnoException(process._errno, 'write'));
  }
  if (req.cb) {
      req.cb();
  }
}

function NetStream(handle) {

  function close() {
    return function (callback) {
      handle.close(callback || noop);
    };
  }

  function $close() {
    $wait(close());
  }

  var paused = false;

  handle.onread = function (buffer, offset, length) {
    var chunk;
    if (buffer) {
      chunk = buffer.slice(offset, offset + length);
    }
    var sync;
    output.write(chunk)(function (err) {
      if (err) { return close()(); }
      if (sync === undefined) {
        // console.log("SYNC");
        sync = true;
      }
      if (paused) {
        // console.log("start");
        paused = false;
        handle.readStart();
      }
    });
    if (sync === undefined) {
      // console.log("ASYNC");
      sync = false;
      if (!paused) {
        paused = true;
        handle.readStop();
        // console.log("stop");
      }
    }
  };

  handle.readStart();

  function write(chunk, encoding) {
    return function (callback) {
      var req;
      if (chunk !== undefined) {
        // console.log("Writing", chunk);
        encoding = Buffer.isBuffer(chunk) ? 'buffer' : encoding;
        req = createWriteReq(handle, chunk, encoding);
      }
      else {
        req = handle.shutdown();
      }

      req.oncomplete = afterWrite;

      // If it was entirely flushed, we can write some more right now.
      // However, if more is left in the queue, then wait until that clears.
      if (handle.writeQueueSize === 0) {
        callback();
      }
      else {
        req.cb = callback;
      }
    };
  }

  function $write(chunk, encoding) {
    return $wait(write(chunk, encoding));
  }

  var output = new Stream();
  return {
    __proto__: handle,
    read: output.read.bind(output),
    $read: output.$read.bind(output),
    close: close,
    $close: $close,
    write: write,
    $write: $write
  };
}


function createServer(address, port, onConnection) {
  var server = new TCP();
  server.bind(address, port);
  server.onconnection = function (client) {
    onConnection(NetStream(client));
  };
  server.listen(511);
  return server;
}

module.exports = {
  createServer: createServer,
};

