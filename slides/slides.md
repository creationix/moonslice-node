# Learning from Past Mistakes

## A New Node HTTP Layer

By Tim Caswell


## BackStory

 - I've contributed to node.js since the very beginning.
 - I helped design the API in the official node "http" module.
 - I architected the "connect" middleware system used by Express.js.
 - I've seen the rise and fall of many web frameworks.


## What is Wrong with Node

 - Callbacks are hard (to many people)
 - Streams leak events (fixed in 0.10.x)


This talk is about what we did wrong and what I would do differently if given the chance. I'll propose a new web layer complete with a prototype implementation that runs in the existing node.js runtime. The changes will involve everything from the callback style to the stream interface, to the node `(req, res)` HTTP handler interface.

I've been researching these new APIs for the last year and even ported node to another language (Lua) just to have more room to experiment.


## Second Slide

This is a para

this is another
