const { verifyUser, verifyToken } = require("../utils/verifyToken.js");
module.exports = app => {
    const bids = require("../controllers/restau_bid.controller.js");
    var router = require("express").Router();

    router.post("/postBid", verifyUser, bids.postBid);
    app.use("/api/restaurant/bids", router);
};