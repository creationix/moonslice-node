var tcp = require('./lib/tcp');

var server = tcp.createServer("0.0.0.0", 3000, function (source, sink) {
  sink(source);
});
console.log("TCP echo server listening at", server.getsockname());


  // console.log("New connection");
  // stream(null, onRead);
  // function onRead(err, data) {
  //   if (err) throw err;
  //   console.log({data:data});
  //   if (data) {
  //     console.log("asking for more data in a while");
  //     setTimeout(function () {
  //       console.log("asking now");
  //       stream(null, onRead);
  //     }, 5000);
  //   }
  // }
