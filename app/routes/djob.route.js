const { verifyUser } = require("../utils/verifyToken.js");

module.exports = app => {
    const djobs = require("../controllers/djob.controller.js");

    var router = require("express").Router();

    router.post("/", verifyUser, djobs.createDJob);

    router.get("/", verifyUser, djobs.getDJobs);

    router.get("/:id", verifyUser, djobs.getDJobById);

    router.post("/update", verifyUser, djobs.updateDJob);

    router.post("/delete", verifyUser, djobs.deleteDJob);

    app.use("/api/djobs", router);
};
