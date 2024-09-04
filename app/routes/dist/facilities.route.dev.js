"use strict";

var _require = require("../utils/verifyToken.js"),
    verifyUser = _require.verifyUser;

module.exports = function (app) {
  var facilities = require("../controllers/facilities.controller.js");

  var router = require("express").Router();

  router.post('/login', facilities.login);
  router.post('/signup', facilities.signup);
  router.post('/logout', facilities.logout);
  router.post('/update', verifyUser, facilities.Update);
  app.use("/api/facilities", router);
};
//# sourceMappingURL=facilities.route.dev.js.map
