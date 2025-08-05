const { verifyUser, verifyToken } = require("../utils/verifyToken.js");

module.exports = app => {
    const hotel_manager = require("../controllers/hotel_manager.controller.js");
    var router = require("express").Router();

    router.post('/login', hotel_manager.login);
    router.post('/signup', hotel_manager.signup);
    router.post('/forgotPassword', hotel_manager.forgotPassword);
    router.post('/verifyCode', hotel_manager.verifyCode);
    router.post('/resetPassword', hotel_manager.resetPassword);
    router.post('/getAllFacilities', verifyUser, hotel_manager.getAllFacilities);
    router.post('/update', verifyUser, hotel_manager.Update);
    router.get('/list', verifyUser, hotel_manager.managers);

    router.post('/addShiftTypeToAll', hotel_manager.addShiftTypeFieldToAll);
    router.post('/addStaffInfoFieldToAll', hotel_manager.addStaffInfoFieldToAll);

    router.post('/addShiftType', verifyUser, hotel_manager.addShiftType);
    router.post('/getShiftTypes', verifyUser, hotel_manager.getShiftTypes);
    router.post('/updateShiftType', verifyUser, hotel_manager.updateShiftType);
    router.post('/deleteShiftType', verifyUser, hotel_manager.deleteShiftType);
    router.get('/acknowledgedUsers', verifyUser, hotel_manager.getAcknowledgedUsers);
    router.post('/addStaffToManager', verifyUser, hotel_manager.addStaffToManager);
    router.post('/deleteStaffFromManager', verifyUser, hotel_manager.deleteStaffFromManager);
    router.post('/getAllStaffShiftInfo', verifyUser, hotel_manager.getAllStaffShiftInfo);
    router.post('/addShiftToStaff', verifyUser, hotel_manager.addShiftToStaff);
    router.post('/editShiftFromStaff', verifyUser, hotel_manager.editShiftFromStaff);
    router.post('/deleteShiftFromStaff', verifyUser, hotel_manager.deleteShiftFromStaff);
    

    app.use("/api/hotel_manager", router);
};
