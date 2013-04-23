// HTTP protocol codec
// Decoder takes in network byte stream of HTTP protocol
// and emits requests
// Encoder takes in responses and emits HTTP protocol
// byte chunks.


function decoder(emit) {
  return function (chunk) {

  };
}

function encoder(emit) {
  return function (chunk) {

  };
}

module.exports = {
 decoder: decoder,
 encoder: encoder
};