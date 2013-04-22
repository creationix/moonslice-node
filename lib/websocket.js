
function decoder(emit) {
  var state = 0;
  var head, payload, key;

  function emitMessage(message) {
    // TODO: encode string messages as strings.
    emit(new Buffer(message), head);
    head = undefined;
    key = undefined;
    payload = undefined;
  }

  function startKey() {
    key = new Array(4);
    state = 4;
  }

  function startBody() {
    if (head.length === 0) {
      return emit("");
    }
    payload = new Array(head.length);
    head.offset = 0;
    state = 8;
  }

  var states = [
    // state 0 - HEADER BYTE 1
    function (byte) {
      head = {};
      head.fin = (byte & 0x80) >> 7;
      head.rsv1 = (byte & 0x40) >> 6;
      head.rsv2 = (byte & 0x20) >> 5;
      head.rsv3 = (byte & 0x10) >> 4;
      head.opcode = (byte & 0x0f);
      state = 1;
    },
    // state 1 - HEADER BYTE 2
    function (byte) {
      head.mask = (byte & 0x80) >> 7;
      var length = byte & 0x7f;
      if (length === 0x7e) {
        state = 2;
      }
      else if (length === 0x7f) {
        throw new Error("64 bit lengths are not supported in JavaScript");
      }
      else {
        head.length = length;
        if (head.mask) {
          startKey();
        }
        else {
          startBody();
        }
      }
    },
    // state 2 - length16-1
    function (byte) {
      head.length = byte << 8;
      state = 3;
    },
    // state 3 - length16-2
    function (byte) {
      head.length |= byte;
      if (head.mask) {
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
      if (head.offset >= head.length) {
        throw new Error("OOB error");
      }
      if (key) {
        payload[head.offset] = byte ^ key[head.offset % 4];
      }
      else {
        payload[head.offset] = byte;
      }
      head.offset++;
      if (head.offset === head.length) {
        emitMessage(payload);
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
  return function (message, head) {
    var binary, length, size, payload;

    if (Buffer.isBuffer(message)) {
      binary = true;
      length = message.length;
    }
    else if (typeof message === 'string') {
      binary = false;
      length = Buffer.byteLength(message);
    }
    else {
      throw new Error("Messages must be Buffers or strings");
    }
    size = length + 2;
    if (head.mask) {
      key.writeUInt32BE(Math.random() * 0x100000000, 0);
      size += 4;
    }

    if (length >= 0x10000) {
      head.length = 0x7f;
      size += 8;
    }
    else if (length >= 0x7e) {
      head.length = 0x7e;
      size += 2;
    }
    else {
      head.length = length;
    }

    payload = new Buffer(size);
    payload[0] = (head.fin  ? 0x80 : 0)
               + (head.rsv1 ? 0x40 : 0)
               + (head.rsv2 ? 0x20 : 0)
               + (head.rsv3 ? 0x10 : 0)
               + (head.opcode || 0);
    payload[1] = (key ? 0x80 : 0)
               + (head.length);

    var offset;

    if (head.length === 0x7f) {
      // throw new Error("64-bit length messages are not supported in JavaScript");
      payload.writeUInt64BE(length, 2);
      offset = 10;
    }
    else if (head.length === 0x7e) {
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

    for (var i = 0, l = message.length; i < l; i++) {
      var byte = message[i];
      payload[offset++] = key ? byte ^ key[i % 4] : byte;
    }
    emit(payload);
  };
}

module.exports = {
  decoder: decoder,
  encoder: encoder
};