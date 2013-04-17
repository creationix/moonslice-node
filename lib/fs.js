var nativeFs = process.binding('fs');
var constants = require('constants');
var Stream = require('./stream');
var Fiber, $wait;
try {
  Fiber = require('fibers');
  $wait = require('./await');
}
catch (err) {
  // the fiber enabled functions won't work
}

function stringToFlags(value) {
  if (typeof value === "number") return value;
  switch (value) {
    case 'r':  return constants.O_RDONLY;
    case 'r+': return constants.O_RDWR;
    case 'w':  return constants.O_CREAT | constants.O_TRUNC | constants.O_WRONLY;
    case 'w+': return constants.O_CREAT | constants.O_TRUNC | constants.O_RDWR;
    case 'a':  return constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY;
    case 'a+': return constants.O_APPEND | constants.O_CREAT | constants.O_RDWR;
    default: throw new Error("Unknown flag string " + JSON.stringify(value));
  }
}

function noop(err) {
  if (err) console.error(err.stack);
}

function fiberback(fiber) {
  return function (err, value) {
    if (err) { fiber.throwInto(err); }
    else { fiber.run(value); }
  };
}

function open(path, flags, mode) {
  return function (callback) {
    return nativeFs.open(path, stringToFlags(flags), mode || 0666, callback || noop);
  };
}

function $open(path, flags, mode) {
  var fiber = Fiber.current;
  nativeFs.open(path, stringToFlags(flags), mode || 0666, fiberback(fiber));
  return Fiber.yield();
}

function read(fd, buffer, offset, length, position) {
  return function (callback) {
    return nativeFs.read(fd, buffer, offset, length, position, callback || noop);
  };
}

function $read(fd, buffer, offset, length, position) {
  var fiber = Fiber.current;
  nativeFs.read(fd, buffer, offset, length, position, fiberback(fiber));
  return Fiber.yield();
}

function write(fd, buffer, offset, length, position) {
  return function (callback) {
    return nativeFs.write(fd, buffer, offset, length, position, callback || noop);
  };
}

function writev(fd, buffers, position) {
  return function (callback) {
    var totalWritten = 0;
    for (var i = 0, l = buffers.length; i < l; i++) {
      var buffer = buffers[i];
      var len = buffer.length;
      nativeFs.write(fd, buffer, 0, len, position, onWrite);
      if (position !== undefined) {
        position += len;
      }
    }
    function onWrite(err, written) {
      totalWritten += written;
      if (i + 1 < l) return;
      if (err) return callback(err);
      callback(null, totalWritten);       
    }
  };
}

function $writev(fd, buffers, position) {
  return $wait(writev(fd, buffers, position));
}

function $write(fd, buffer, offset, length, position) {
  var fiber = Fiber.current;
  nativeFs.write(fd, buffer, offset, length, position, fiberback(fiber));
  return Fiber.yield();
}

function close(fd) {
  return function (callback) {
    return nativeFs.close(fd, callback || noop);
  };
}

function $close(fd) {
  var fiber = Fiber.current;
  nativeFs.close(fd, fiberback(fiber));
  return Fiber.yield();
}


function stat(path) {
  return function (callback) {
    return nativeFs.stat(path, callback || noop);
  };
}

function $stat(path) {
  var fiber = Fiber.current;
  nativeFs.stat(path, fiberback(fiber));
  return Fiber.yield();
}

function fstat(fd) {
  return function (callback) {
    return nativeFs.fstat(fd, callback || noop);
  };
}

function $fstat(fd) {
  var fiber = Fiber.current;
  nativeFs.fstat(fd, fiberback(fiber));
  return Fiber.yield();
}

function lstat(path) {
  return function (callback) {
    return nativeFs.lstat(path, callback || noop);
  };
}

function $lstat(fd) {
  var fiber = Fiber.current;
  nativeFs.lstat(fd, fiberback(fiber));
  return Fiber.yield();
}

function WriteStream(fd, options) {

  // Merge options with default values.
  if (options) {   
    if ("start" in options) { this.position = options.start; }
    if ("autoClose" in options) { this.autoClose = options.autoClose; }
  }
  this.fd = fd;
}

WriteStream.prototype.position = undefined;
WriteStream.prototype.autoClose = true;

WriteStream.prototype.write = function (chunk) {
  var self = this;
  return function (callback) {
    if (!chunk) {
      if (self.autoClose) {
        close(self.fd)(callback);
      }
      return;
    }
    
    var length = chunk.length;
    
    if (Array.isArray(chunk)) {
      writev(self.fd, chunk, self.position)(onWrite);
    }
    else {
      write(self.fd, chunk, 0, length, self.position)(onWrite);
    }
    function onWrite(err, written) {
      if (err) {
        if (self.autoClose) { close(self.fd)(); }
        return callback(err);
      }
      if (written < length) {
        throw new Error("TODO: Implement partial write retries");
      }
      if (this.position !== undefined) {
        this.position += written;
      }
      callback();
    }
  };
};

function ReadStream(fd, options) {

  // Merge options with default values
  var position = 0,
      end,
      autoClose = true,
      bufferSize = 64 * 1024,
      encoding;
  if (options) {
    if ("start" in options) { position = options.start; }
    if ("end" in options) { end = options.end; }
    if ("autoClose" in options) { autoClose = options.autoClose; }
    if ("bufferSize" in options) { bufferSize = options.bufferSize; }
    if ("encoding" in options) { encoding = options.encoding; }
  }

  // Call the parent constructor
  Stream.call(this);

  var self = this;
  var reading = false;

  var buffer;
  function startRead() {
    if (reading) { return; }
    reading = true;
    
    // Bail out if we reach the artificial end.
    if (position > end) {
      return Stream.prototype.write.call(self)();
    }

    // Figure out how many bytes we want to read.
    var length = bufferSize;
    if (end !== undefined && length > end - position + 1) {
      length = end - position + 1;
    }
    buffer = new Buffer(length);
    read(fd, buffer, 0, length, position)(onRead);
  }

  function onRead(err, bytesRead) {
    reading = false;
    if (err) {
      self.errList.push(err);
      if (autoClose) { close(fd)(); }
      return self.checkQueue();
    }
    if (!bytesRead) {
      if (autoClose) { close(fd)(); }
      return Stream.prototype.write.call(self)();
    }

    if (bytesRead < buffer.length) {
      buffer = buffer.slice(0, bytesRead);
    }
    if (encoding) {
      buffer = buffer.toString(encoding);
    }
    position += bytesRead;
    Stream.prototype.write.call(self, buffer)(startRead);
  }
  startRead();
}
ReadStream.prototype.__proto__ = Stream.prototype;

ReadStream.prototype.write = function () {
  throw new TypeError("fs.ReadStream is not writable!");
};

module.exports = {
  ReadStream: ReadStream,
  WriteStream: WriteStream,
  open: open,
  read: read,
  write: write,
  writev: writev,
  close: close,
  stat: stat,
  fstat: fstat,
  lstat: lstat,
  $open: $open,
  $read: $read,
  $write: $write,
  $writev: $writev,
  $close: $close,
  $stat: $stat,
  $fstat: $fstat,
  $lstat: $lstat
};
