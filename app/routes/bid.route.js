const { verifyUser, verifyToken } = require("../utils/verifyToken.js");
module.exports = app => {
  const bids = require("../controllers/bids.controller.js");

  var router = require("express").Router();

  // Create a new Spot
  router.post("/postBid", verifyUser, bids.postBid);

  app.use("/api/bids", router);
};