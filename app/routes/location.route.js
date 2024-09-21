const { verifyUser, verifyToken } = require("../utils/verifyToken.js");
module.exports = app => {
  const location = require("../controllers/location.controller.js");

  var router = require("express").Router();

  // Create a new Spot
  router.get("/getList", location.getList);
  router.post("/addItem", location.addItem);

  app.use("/api/location", router);
};