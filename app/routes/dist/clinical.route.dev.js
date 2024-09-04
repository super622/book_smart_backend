"use strict";

var _require = require("../utils/verifyToken.js"),
    verifyUser = _require.verifyUser;

module.exports = function (app) {
  var clinical = require("../controllers/clinical.controller.js");

  var router = require("express").Router();

  router.post('/d:\testing\BookSmart-main\BookSmart-backendlogin', clinical.login);
  router.post('/d:\testing\BookSmart-main\BookSmart-backendsignup', clinical.signup);
  router.post('/d:\testing\BookSmart-main\BookSmart-backendlogout', clinical.logout);
  router.post('/d:\testing\BookSmart-main\BookSmart-backendupdate', verifyUser, clinical.Update);
  app.use("/api/clinical", router);
};
//# sourceMappingURL=clinical.route.dev.js.map
