var Queue = require('./queue');
var $wait;
try {
  $wait = require('./await');
}
catch (err) {
  // Fiber based function won't work
}

module.exports = Stream;

Stream.isReadable = function (stream) {
  return stream && typeof stream.read === "function";
};

Stream.isWritable = function (stream) {
  return stream && typeof stream.write === "function";
};

Stream.isDuplex = function (stream) {
  return stream && typeof stream.write === "function"
                && typeof stream.read === "function";
};

function Stream() {
  this.paused = false;
  this.processing = false;
  this.dataQueue = new Queue();
  this.readQueue = new Queue();
  this.resumeList = [];
  this.errList = [];
}

Stream.prototype.highWaterMark = 1;
Stream.prototype.lowWaterMark = 1;

Stream.prototype.checkQueue = function () {
  // This function is not re-entrant.
  // Keep out recursive calls with a binary semaphore.
  if (this.processing) { return; }
  this.processing = true;

  //console.log({data:this.dataQueue.length,read:this.readQueue.length});
  // Let's play matchmaker and pair data with readers
  while (this.dataQueue.length && (this.readQueue.length | this.errList.length)) {
    var reader = this.readQueue.shift();
    if (this.errList.length) {
      reader(this.errList.shift());
    }
    reader(null, this.dataQueue.shift());
  }

  // Flow control logic for high-water/low-water and pause/resume.
  var depth = this.dataQueue.length - this.readQueue.length;
  if (!this.paused && depth >= this.highWaterMark) {
    // If there is too much data and not enough readers,
    // tell the writer to pause.
    this.paused = true;
  }
  else if (this.paused && depth <= this.lowWaterMark) {
    // If we're paused and there is room for more data,
    // tell the writer to resume
    this.paused = false;
    // and flush any pending write callbacks.
    for (var i = 0, l = this.resumeList.length; i < l; i++) {
      process.nextTick(this.resumeList[i]);
    }
    this.resumeList.length = 0;
  }

  // We're done here, allow this function to be called again.
  this.processing = false;
};


Stream.prototype.read = function () {
  var self = this;
  return function (callback) {
    self.readQueue.push(callback);
    self.checkQueue();
  };
};

Stream.prototype.$read = function () {
  return $wait(this.read());
};

Stream.prototype.write = function (chunk) {
  var self = this;
  return function (callback) {
    self.dataQueue.push(chunk);
    self.checkQueue();
    if (!callback) { return; }
    if (self.paused) {
      self.resumeList.push(callback);
      return;
    }
    callback();
  };
};

Stream.prototype.$write = function (chunk) {
  return $wait(this.write(chunk));
};
