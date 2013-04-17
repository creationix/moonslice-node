# Learning from Past Mistakes

## A New Node HTTP Layer

By Tim Caswell


<img style="border:0;box-shadow:inherit;background:inherit" src="creationix-logo.svg" alt="Creationix Innovations">


## BackStory

 - I've contributed to node.js since the very beginning.
 - I helped design the API in the official node "http" module.
 - I architected the "connect" middleware system used by Express.js.
 - I've seen the rise and fall of many web frameworks.


## What was Wrong with Node

 - Callbacks are hard.
 - Streams leak events.
 - HTTP route layers are hard to compose.
 - Websocket requests do not emit "request" events.
 - Proper error handling was near impossible.
 - Servers would often be unstable.


## Change is Hard

 - Node is used in production at many companies.
 - Changing APIs is *very* expensive.
 - Language changes were slow for the same reasons.
 - Nobody wants to break the web.


## A Lua Experiment

 - I heard good things about Lua.
 - Lua is compatable with node.js style APIs
 - Lua has coroutines.


```lua
local http = require "http"

http.createServer(function (req, res)
  res.writeHead(200, {
    ["Content-Length"] = 12,
    ["Content-Type"] = "text/plain"
  })
  res.end("Hello World\n")
end).listen(8080)
```



<img style="border:0;box-shadow:inherit;background:inherit" src="creationix-logo.svg" alt="Creationix Innovations">
