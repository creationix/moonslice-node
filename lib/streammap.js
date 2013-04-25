var $wait = require('./await');
var Queue = require('./queue');

function streamMap(stream, codec) {
  var wrapped = {};
  if (codec.decoder) {
    var inQueue = new Queue();
    var decode = codec.decoder(function (output) {
      inQueue.push(output);
    });
    wrapped.read = function () {
      return function (callback) {
        read();

        function read() {
          if (inQueue.length) {
            callback(null, inQueue.shift());
          }
          else {
            stream.read()(onRead);
          }
        }
        function onRead(err, chunk) {
          if (err) return callback(err);
          decode(chunk);
          read();
        }
      };
    };
    wrapped.$read = function () {
      return $wait(wrapped.read());
    };
  }
  if (codec.encoder) {
    var pending = [];
    var errors = [];
    var async;

    var encode = codec.encoder(function (output) {
      async = undefined;
      stream.write(output)(function (err) {
        if (async === undefined) async = false;
        if (err) errors.push(err);
        check();
      });
      if (async === undefined) async = true;
    });

    function check() {
      while (pending.length && (errors.length || !async)) {
        pending.shift()(errors.shift());
      }
    }

    wrapped.write = function (chunk) {
      return function (callback) {
        encode(chunk);
        pending.push(callback);
        check();
      };
    };

    wrapped.$write = function (chunk) {
      return $wait(wrapped.write(chunk));
    };
  }
  return wrapped;
}

module.exports = streamMap;