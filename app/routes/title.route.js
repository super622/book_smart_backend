module.exports = app => {
    const title = require("../controllers/title.controller.js");
    var router = require("express").Router();

    router.get("/getTitles", title.getTitles);
    router.post("/addTitle", title.addTitle);

    app.use("/api/title", router);
};