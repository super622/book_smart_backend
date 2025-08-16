const { verifyUser, verifyToken } = require("../utils/verifyToken.js");

module.exports = app => {
    const restau_manager = require("../controllers/restau_manager.controller.js");
    var router = require("express").Router();

    router.post('/login', restau_manager.login);
    router.post('/signup', restau_manager.signup);
    router.post('/forgotPassword', restau_manager.forgotPassword);
    router.post('/verifyCode', restau_manager.verifyCode);
    router.post('/resetPassword', restau_manager.resetPassword);
    router.post('/getAllFacilities', verifyUser, restau_manager.getAllFacilities);
    router.post('/update', verifyUser, restau_manager.Update);
    router.get('/list', verifyUser, restau_manager.managers);
    
    router.post('/addShiftTypeToAll', restau_manager.addShiftTypeFieldToAll);
    router.post('/addStaffInfoFieldToAll', restau_manager.addStaffInfoFieldToAll);
    router.post('/clearShiftTypeForAll', restau_manager.clearShiftTypeForAll);
    
    router.post('/addShiftType', verifyUser, restau_manager.addShiftType);
    router.post('/getShiftTypes', verifyUser, restau_manager.getShiftTypes);
    router.post('/updateShiftType', verifyUser, restau_manager.updateShiftType);
    router.post('/deleteShiftType', verifyUser, restau_manager.deleteShiftType);
    router.get('/acknowledgedUsers', verifyUser, restau_manager.getAcknowledgedUsers);
    router.post('/addStaffToManager', verifyUser, restau_manager.addStaffToManager);
    router.post('/deleteStaffFromManager', verifyUser, restau_manager.deleteStaffFromManager);
    router.post('/getAllStaffShiftInfo', verifyUser, restau_manager.getAllStaffShiftInfo);
    router.post('/addShiftToStaff', verifyUser, restau_manager.addShiftToStaff);
    router.post('/editShiftFromStaff', verifyUser, restau_manager.editShiftFromStaff);
    router.post('/deleteShiftFromStaff', verifyUser, restau_manager.deleteShiftFromStaff);
    
    app.use("/api/restau_manager", router);
    
};
