var TCP = process.binding('tcp_wrap').TCP;
var uvToSource = require('./uv_stream_to_source');
var uvToSink = require('./uv_stream_to_sink');

function createServer(address, port, onConnection) {
  var server = new TCP();
  server.bind(address, port);
  server.onconnection = function (client) {
    onConnection({
      source: uvToSource(client),
      sink: uvToSink(client)
    });
  };
  server.listen(511);
  return server;
}

function connect(address, port, callback) {
  var client = new TCP();
  var req = client.connect(address, port);
  if (!req) {
    return callback(errnoException(process._errno, 'connect'));
  }
  req.oncomplete = function (status) {
    if (status) {
      return callback(errnoException(process._errno, 'onconnect'));
    }
    callback(null, {
      source: uvToSource(client),
      sink: uvToSink(client)
    });
  };
  return client;
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


module.exports = {
  createServer: createServer,
  connect: connect
};

