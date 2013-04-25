// HTTP protocol codec
// Decoder takes in network byte stream of HTTP protocol
// and emits requests
// Encoder takes in responses and emits HTTP protocol
// byte chunks.

var HTTPParser = process.binding('http_parser').HTTPParser;
var statusCodes = require('http').STATUS_CODES;
var Stream = require('./stream');
var $wait = require('./await');

function decoder(emit) {
  var parser = new HTTPParser(HTTPParser.REQUEST);
  var body;

  parser.onHeadersComplete = function (info) {
    body = new Stream();
    info.body = body;
    emit(info);
  };
  parser.onBody = function (buffer, offset, length) {
    var chunk = buffer.slice(offset, length);
    body.write(chunk)(function (err) {
      if (err) emit(err);
    });
  };
  parser.onMessageComplete = function () {
    body.write()(function (err) {
      if (err) emit (err);
    });
  };

  return function (chunk) {
    if (!chunk) {
      return emit(chunk);
    }
    var ret = parser.execute(chunk, 0, chunk.length);
    if (ret instanceof Error) {
      throw ret;
    } else if (parser.incoming && parser.incoming.upgrade) {
      throw new Error("TODO: Implement upgrade");
    }
  };
}

function encoder(emit) {
  return function (response) {
    var code = response.statusCode;
    var headers = response.headers;
    var body = response.body;
    var head = "HTTP/1.1 " + code + " " + statusCodes[code] + "\r\n";
    for (var i = 0, l = headers.length; i < l; i += 2) {
      head += headers[i] + ": " + headers[i + 1] + "\r\n";
    }
    head += "\r\n";

    if (typeof body === "string") {
      emit(head + body);
    }
    else {
      emit(head);
      if (Buffer.isBuffer(body)) {
        emit(body);
      }
      else if (Stream.isReadable(body)) {
        pump(body, emit);
      }
    }
  };
}

// Read all of a stream, emitting events
function pump(readable, emit) {
  var sync;
  read();
  function read() {
    do {
      sync = undefined;
      readable.read()(onRead);
    } while(sync);
    sync = false;
  }
  function onRead(err, data) {
    if (err) return emit(err);
    if (sync === undefined) sync = true;
    if (data) {
      emit(data);
      if (!sync) read();
    }
  }
}

function finalize(response) {
  var has = {};
  var code = response.statusCode;
  var headers = response.headers;
  var body = response.body;
  var staticLength;
  var streaming;

  // Force all 2xx responses to have a body
  if (code >= 200 && code < 300) {
    if (!body) body = response.body = "";
  }

  // Detect the body type
  if (typeof body === "string") {
    staticLength = Buffer.byteLength(body);
  }
  else if (Buffer.isBuffer(body)) {
    staticLength = body.length;
  }
  else if (Stream.isReadable(body)) {
    streaming = true;
  }

  // Index the header keys
  for (var i = 0, l = headers.length; i < l; i += 2) {
    has[headers[i].toLowerString()] = true;
  }

  // Auto-set Content-Length if the body is static
  if (staticLength !== undefined && !has["content-length"]) {
    headers.push("Content-Length", staticLength);
    has["content-length"] = true;
  }

  // Auto-set Content-Encoding if there is a body
  if (body !== undefined && !has["content-encoding"]) {
    headers.push("Content-Encoding", "text/html");
    has["content-encoding"] = true;
  }

  // Add a server header if it's not there.
  if (!has.server) {
    headers.push("Server", "MoonSlice");
    has.server = true;
  }

  // Add the required data header if it's missing.
  if (!has.date) {
    headers.push("Date", (new Date()).toUTCString());
    has.date = true;
  }

  return response;
}

function realNormalize(response) {
  if (!response) {
    response = {};
  }
  else if (typeof response === "string" ||
          (typeof response === "object" && typeof response.read === "function")) {
    response = { body: response };
  }
  if (typeof response !== "object") {
    throw new Error("Response must be a string, stream, continuable, or response object");
  }
  if (!("statusCode" in response)) {
    response.statusCode = 200;
  }
  var headers = response.headers;
  if (!headers) {
    headers = response.headers = [];
  }
  return response;
}

function normalize(response) {
  return function (callback) {
    // They returned a continuable, we need to wait for it.
    if (typeof response === "function") {
      response(function (err, response) {
        if (err) return callback(err);
        callback(null, realNormalize(response));
      });
    }
    else {
      callback(null, realNormalize(response));
    }
  };
}

function $normalize(response) {
  if (typeof response === "function") {
    return realNormalize($wait(response));
  }
  return realNormalize(response);
}

module.exports = {
 decoder: decoder,
 encoder: encoder,
 normalize: normalize,
 $normalize: $normalize,
 finalize: finalize
};