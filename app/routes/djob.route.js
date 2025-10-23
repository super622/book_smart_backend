const { verifyUser } = require("../utils/verifyToken.js");

module.exports = app => {
    const djobs = require("../controllers/djob.controller.js");

    var router = require("express").Router();

    router.post("/", verifyUser, djobs.createDJob);

    router.get('/admin/:adminId', djobs.getDJobs);

    router.get("/:id", verifyUser, djobs.getDJobById);

    router.post("/update", verifyUser, djobs.updateDJob);

    router.post("/delete", verifyUser, djobs.deleteDJob);

    router.post("/cliniciandjobs", verifyUser, djobs.getClinicianDJobs);

    router.post("/getfacilitydjobs", verifyUser, djobs.getFacilitiesDJobs); 

    app.use("/api/djobs", router);
};
