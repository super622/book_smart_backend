const { verifyUser, verifyToken } = require("../utils/verifyToken.js");
module.exports = app => {
    const bids = require("../controllers/hotel_bid.controller.js");
    var router = require("express").Router();

    router.post("/postBid", verifyUser, bids.postBid);
    app.use("/api/hotel/bids", router);
};