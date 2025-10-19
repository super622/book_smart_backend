const { verifyUser, verifyToken } = require("../utils/verifyToken.js");
module.exports = app => {
  const degrees = require("../controllers/degree.controller.js");

  var router = require("express").Router();

  // Create a new Spot
  router.get("/getList", degrees.getList);
  router.post("/addItem", degrees.addItem);
  router.post('/updateDegreesWithDid', degrees.updateDegreesWithDid);
  router.post('/deleteItem', degrees.deleteItem);

  app.use("/api/degree", router);
};