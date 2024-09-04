"use strict";

var http = require('http');

var _require = require("socket.io"),
    Server = _require.Server;

var mongoose = require('mongoose');

var httpServer = http.createServer();
var io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
}); // const db = mongoose.connection;

var db = require("./app/models");

var Chat = db.chats;
io.on('connection', function (socket) {
  console.log('a user connected');
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
}); // io.on('connection', (socket) => {
//   console.log('New client connected');
//   socket.on('message', (message) => {
//     console.log('New message:', message);
//     const newMessage = new Chat({
//       userName: message.username,
//       message: message.message,
//       timestamp: new Date() // Save the current server time to the database
//     });
//     newMessage.save();
//     io.emit('message', message);
//   });
//   socket.on('disconnect', () => {
//     console.log('Client disconnected');
//   });
// });

var PORT = 8080;
httpServer.listen(PORT, function () {
  console.log("Socket.IO server is running on port ".concat(PORT));
});
//# sourceMappingURL=socketServer.dev.js.map
