// Wrap a readable uv_stream_t (like a tcp socket)
// Returning a readable pull-stream function.
module.exports = function (handle) {
  var dataQueue = [];
  var readQueue = [];
  var paused = true;
  function check() {
    while (dataQueue.length && readQueue.length) {
      readQueue.shift().apply(null, dataQueue.shift());
    }
    // If there are pending readers, we need more data
    if (readQueue.length && paused) {
      handle.readStart();
      console.log("readStart");
      paused = false;
    }
    // if there is extra data, we need to stop getting data.
    else if (dataQueue.length && !paused) {
      handle.readStop();
      console.log("readStop");
      paused = true;
    }
  }

  handle.onread = function (buffer, offset, length) {
    if (!buffer) {
      dataQueue.push([]);
    }
    else {
      var chunk = buffer.slice(offset, offset + length);
      dataQueue.push([null, chunk]);    
    }
    check();
  };
  
  return function uv_source(close, callback) {
    // Handle close signal
    if (close) {
      // non true, but truthy values are close reasons
      if (close === true) close = undefined;
      handle.close(function (err) {
        //
        callback(err || close);
      });
      return;
    }
    readQueue.push(callback);
    check();
  };
};
