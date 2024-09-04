"use strict";

var http = require('http');

var _require = require("socket.io"),
    Server = _require.Server;

var httpServer = http.createServer();
var io = new Server(httpServer);

var db = require("./app/models");

var Chat = db.chats;
io.on('connection', function (socket) {
  console.log('New client connected');
  socket.on('message', function (message) {
    console.log('New message:', message);
    var newMessage = new Chat({
      userName: message.username,
      message: message.message,
      timestamp: new Date() // Save the current server time to the database

    });
    newMessage.save();
    io.emit('message', message);
  });
  socket.on('disconnect', function () {
    console.log('Client disconnected');
  });
});
var PORT = 3001;
httpServer.listen(PORT, function () {
  console.log("Socket.IO server is running on port ".concat(PORT));
});
//# sourceMappingURL=socketHandler.dev.js.map
