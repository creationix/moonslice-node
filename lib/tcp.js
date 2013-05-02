var TCP = process.binding('tcp_wrap').TCP;
var uvToSource = require('./uv_stream_to_source');
var uvToSink = require('./uv_stream_to_sink');

function createServer(address, port, onConnection) {
  var server = new TCP();
  server.bind(address, port);
  server.onconnection = function (client) {
    onConnection(uvToSource(client), uvToSink(client));
  };
  server.listen(511);
  return server;
}

module.exports = {
  createServer: createServer,
};

