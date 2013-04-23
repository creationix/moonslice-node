// Websocket protocol codec.
// Decoder takes in a network byte stream of
// websocket protocol and emits message objects.
// Encoder takes in message objects
// and emits network byte chunks.

// Message is an object with the following structure:
//
//   fin:  boolean
//   rsv1: boolean
//   rsv2: boolean
//   rsv3: boolean
//   opcode: integer
//   mask: boolean,
//   body: buffer or string


function decoder(emit) {
  var state = 0,
      message = null,
      offset = 0,
      length = 0,
      key = new Array(4);

  function emitMessage() {
    // TODO: encode string messages as strings.
    message.body = new Buffer(message.body);
    emit(message);
    message = null;
    length = 0;
    offset = 0;
  }

  function startKey() {
    state = 4;
  }

  function startBody() {
    if (length === 0) {
      message.body = "";
      return emitMessage();
    }
    message.body = new Array(length);
    state = 8;
  }

  var states = [
    // state 0 - HEADER BYTE 1
    function (byte) {
      message = {
        fin:  !!(byte & 0x80),
        rsv1: !!(byte & 0x40),
        rsv2: !!(byte & 0x20),
        rsv3: !!(byte & 0x10),
        opcode: (byte & 0x0f),
        mask: false,
        body: null
      };
      state = 1;
    },
    // state 1 - HEADER BYTE 2
    function (byte) {
      message.mask = !!(byte & 0x80);
      var len = byte & 0x7f;
      if (len === 0x7e) {
        state = 2;
      }
      else if (len === 0x7f) {
        throw new Error("64 bit lengths are not supported in JavaScript");
      }
      else {
        length = len;
        if (message.mask) {
          startKey();
        }
        else {
          startBody();
        }
      }
    },
    // state 2 - length16-1
    function (byte) {
      length = byte << 8;
      state = 3;
    },
    // state 3 - length16-2
    function (byte) {
      length |= byte;
      if (message.mask) {
        startKey();
      }
      else {
        startBody();
      }
    },
    // state 4 - masking-key-1
    function (byte) {
      key[0] = byte;
      state = 5;
    },
    // state 5 - masking-key-2
    function (byte) {
      key[1] = byte;
      state = 6;
    },
    // state 6 - masking-key-3
    function (byte) {
      key[2] = byte;
      state = 7;
    },
    // state 7 - masking-key-4
    function (byte) {
      key[3] = byte;
      startBody();
    },
    // state 8 - payload data
    function (byte) {
      if (offset >= length) {
        throw new Error("OOB error");
      }
      message.body[offset++] = message.mask ? byte ^ key[offset % 4] : byte;
      if (offset === length) {
        emitMessage();
      }
    }
  ];

  return function (chunk) {
    for (var i = 0, l = chunk.length; i < l; i++) {
      states[state](chunk[i]);
    }
  };

}


function encoder(emit) {
  var key = new Buffer(4);
  return function (message) {
    var offset = 0,
        length = 0,
        size = 0,
        body = null,
        payload = null;

    body = Buffer.isBuffer(message.body) ? message.body : new Buffer(message.body);

    length = body.length;
    size = length + 2;
    if (message.mask) {
      key.writeUInt32BE(Math.random() * 0x100000000, 0);
      size += 4;
    }

    if (length >= 0x10000) {
      length = 0x7f;
      size += 8;
    }
    else if (length >= 0x7e) {
      length = 0x7e;
      size += 2;
    }
    else {
      length = length;
    }

    payload = new Buffer(size);
    payload[0] = (message.fin  ? 0x80 : 0)
               | (message.rsv1 ? 0x40 : 0)
               | (message.rsv2 ? 0x20 : 0)
               | (message.rsv3 ? 0x10 : 0)
               | (message.opcode || 0);
    payload[1] = (key ? 0x80 : 0)
               | (length);

    if (length === 0x7f) {
      // throw new Error("64-bit length messages are not supported in JavaScript");
      payload.writeUInt64BE(length, 2);
      offset = 10;
    }
    else if (length === 0x7e) {
      payload.writeUInt16BE(length, 2);
      offset = 4;
    }
    else {
      offset = 2;
    }

    if (key) {
      payload[offset++] = key[0];
      payload[offset++] = key[1];
      payload[offset++] = key[2];
      payload[offset++] = key[3];
    }

    for (var i = 0, l = length; i < l; i++) {
      var byte = message.body[i];
      payload[offset++] = key ? byte ^ key[i % 4] : byte;
    }
    emit(payload);
  };
}

module.exports = {
  decoder: decoder,
  encoder: encoder
};