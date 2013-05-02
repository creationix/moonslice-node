// Wrap a writable uv_stream_t (like a tcp socket)
// Returning a stream sink that consumes pull streams
module.exports = function uv_sink(handle) {
  return function uv_sink(read) {
    read(null, onRead);
    function onRead(err, chunk) {
      if (err) throw err;
      write(handle, chunk, onWrite);
    }
    function onWrite(err) {
      if (err) throw err;
      read(null, onRead);
    }
  };
};

function write(handle, chunk, callback) {
  var req, encoding;
  if (chunk !== undefined) {
    encoding = Buffer.isBuffer(chunk) ? 'buffer' : encoding;
    req = createWriteReq(handle, chunk, encoding);
  }
  else {
    req = handle.shutdown();
  }

  if (!req) {
    return callback(errnoException(process._errno, 'write'));
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
}

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
  return e;
}

function afterWrite(status, handle, req) {
  if (status) {
    return req.cb(errnoException(process._errno, 'onwrite'));
  }
  if (req.cb) {
      req.cb();
  }
}

