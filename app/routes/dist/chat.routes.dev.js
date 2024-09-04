"use strict";

module.exports = function (app) {
  var chats = require("../controllers/chat.controller.js"); // const chat = require("../socketServer.js")


  var router = require("express").Router(); // Create a new Spot


  router.post("/", chats.create);
  router.get("/message", chats.getMessage);
  router.post("/wallet", chats.wallet); // router.post('/save-avatar', chats.avatar);

  app.use("/api/chat", router);
};
//# sourceMappingURL=chat.routes.dev.js.map
