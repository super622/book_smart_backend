"use strict";

var db = require("../models");

var Chat = db.chats;

var socketHandler = function socketHandler(io) {
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
};
//# sourceMappingURL=soket.dev.js.map
