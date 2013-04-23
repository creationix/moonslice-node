var $wait;
try {
  $wait = require('./await');
}
catch (err) {
  // ignored
}
var Queue = require('./queue');

function streamMap(stream, codec) {
  var wrapped = {};
  var dataQueue = new Queue();
  if (codec.decode) {
    var decoder = codec.decode(function (output) {
      dataQueue.push(output);
    });
    wrapped.read = function () {
      return function (callback) {
        read();
        
        function read() {
          if (dataQueue.length) {
            callback(null, dataQueue.shift());
          }
          else {
            stream.read()(onRead);          
          }
        }
        function onRead(err, chunk) {
          if (err) return callback(err);
          decoder(chunk);
          read();
        }
      };
    };
    wrapped.$read = function () {
      return $wait(wrapped.read());
    };
  }
  if (codec.encode) {
    throw new Error("TODO: implement encoder stream");
    // var encoder = codec.encode(function (output) {
    //   
    // });
    // wrapped.write = function (chunk) {
    //   return function (callback) {
    //     
    //   };
    // };
    // wrapped.$write = function (chunk) {
    //   return $wait(wrapped.write(chunk));
    // };
  }
  return wrapped;
}

module.exports = streamMap;