function byteSize(size) {
  function decode(emit) {
    var chunks = [];
    var bytes = 0;
    return function (chunk) {

      // Pass through EOS and leftover bytes
      if (!chunk) {
        if (bytes) {
          emit(Buffer.concat(chunks, bytes));
          chunks.length = 0;
          bytes = 0;
          return emit(chunk);
        }
      }

      var length = chunk.length;
      var offset = 0, part;
      do {
  
        // Empty or end of chunk
        if (offset === length) break;

        // Not enough data yet to emit a chunk, store the bytes
        if (offset + size > length + bytes) {
          part = chunk.slice(offset);
          chunks.push(part);
          bytes += part.length;
        }
        
        // We now have enough, but there are previous chunks to merge
        else if (bytes) {
          part = chunk.slice(0, size - bytes);
          chunks.push(part);
          bytes += part.length;
          emit(Buffer.concat(chunks, bytes));
          bytes = 0;
          chunks.length = 0;
          offset += part.length;
          // rest and try again to see if there is leftover.
          continue;
        }
        
        // There was no previous data and we have enough now.
        else {
          emit(chunk.slice(offset, offset + size));
        }
        offset += size;
      } while (offset < length);
    };
  }
  return {
    decode: decode
  };
}

module.exports = byteSize;