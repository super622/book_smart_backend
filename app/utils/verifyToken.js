const jwt = require('jsonwebtoken');
const db = require("../models");
const Clinical =  db.clinical;
const Facility = db.facilities;
const Admin = db.admins;
const RestaurantUser = db.restau_user;
const RestaurantManager = db.restau_manager;

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    // console.log(authHeader)
    if (authHeader) {
        console.log('hhhhhh')
        const token = authHeader.split(' ')[1];
        console.log('token=-================>',"----",token)
        if (!token) {
            return res.status(401).json({ success: false, message: "You are not authorized!" });
        }
    
        // If token exists, verify the token
        jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
            if (err) {
                console.log('err',err)
                return res.status(401).json({ success: false, message: "Token is invalid" });
            }
            req.user = user;
            // console.log(req.user)
            next();
        });
    }
};

const setToken = (tokendata) => {
    // console.log(process.env.JWT_SECRET_KEY)
   const token = jwt.sign(tokendata, process.env.JWT_SECRET_KEY);
   return token;
}

const verifyUser = (req, res, next) => {
    console.log('verifyToken');
    console.log(req.user);
    verifyToken(req, res, async () => {
        console.log(req.user)
        let isUser = {};
        if (req.user.userRole === "Facilities") {
            isUser = await Facility.findOne({contactEmail: req.user.contactEmail, userRole: req.user.userRole}, { aic: 1, userStatus: 1, userRole: 1, entryDate: 1, companyName: 1, firstName: 1, lastName: 1, contactEmail: 1, contactPhone: 1 })
        } else if (req.user.userRole === "Clinician") {
            isUser = await Clinical.findOne({email: req.user.email, userRole: req.user.userRole}, { email: 1, aic: 1, firstName: 1, lastName: 1, userRole: 1, phoneNumber: 1, title: 1, userStatus: 1 })
        } else if (req.user.userRole === "Admin") {
            isUser = await Admin.findOne({email: req.user.email, userRole: req.user.userRole}, { email: 1, userRole: 1, userStatus: 1, firstName: 1, lastName: 1 });
        } else if (req.user.userRole === "restaurantWork") {
            isUser = await RestaurantUser.findOne({email: req.user.email, userRole: req.user.userRole}, { email: 1, aic: 1, firstName: 1, lastName: 1, userRole: 1, phoneNumber: 1, title: 1, userStatus: 1 });
        } else if (req.user.userRole === "restaurantManager") {
            isUser = await RestaurantManager.findOne({contactEmail: req.user.contactEmail, userRole: req.user.userRole}, { aic: 1, userStatus: 1, userRole: 1, entryDate: 1, companyName: 1, firstName: 1, lastName: 1, contactEmail: 1, contactPhone: 1 })
        }
        
        console.log(isUser);
        if (isUser) {
            req.user = isUser;
            next();
        } else {
            return res.status(401).json({success: false, message: "You are not authenticated!"});
        }
    });
};

const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role === 'admin') {
            next();
        } else {
            return res.status(401).json({ success: false, message: "You are not authorized" });
        }
    });
};

module.exports = {
    verifyToken,
    verifyUser,
    verifyAdmin,
    setToken
};