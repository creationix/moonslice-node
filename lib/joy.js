var byte8 = require('./bytesize')(8).decode;

function joyDecode(emit) {
  return byte8(function (chunk) {
    if (!chunk) {
      return emit(chunk);
    }
    var event = {                                                      
      time: chunk.readUInt32LE(0),                                    
      value: chunk.readInt16LE(4),                                    
      number: chunk[7],                                               
    };                                                   
    var type = chunk[6];                                              
    if (type & 0x80) event.init = true;                                
    if (type & 0x01) event.type = "button";                            
    if (type & 0x02) event.type = "axis";                              
    emit(event);
  });
}

module.exports = {
  decode: joyDecode
};