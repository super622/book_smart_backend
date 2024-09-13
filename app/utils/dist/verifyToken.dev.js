"use strict";

var jwt = require('jsonwebtoken');

var db = require("../models");

var Auth = db.authentications;
var Clinical = db.clinical;
var Facility = db.facilities;
var expirationTime = 2592000;

var verifyToken = function verifyToken(req, res, next) {
  var authHeader = req.headers.authorization;
  console.log(authHeader);

  if (authHeader) {
    console.log('hhhhhh');
    var token = authHeader.split(' ')[1]; // console.log('token=-================>',"----",token)

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "You are not authorized!"
      });
    } // If token exists, verify the token


    jwt.verify(token, process.env.JWT_SECRET_KEY, function (err, user) {
      if (err) {
        console.log('err', err);
        return res.status(401).json({
          success: false,
          message: "Token is invalid"
        });
      }

      req.user = user; // console.log(req.user)

      next();
    });
  }
};

var setToken = function setToken(tokendata) {
  console.log(process.env.JWT_SECRET_KEY);
  var token = jwt.sign(tokendata, process.env.JWT_SECRET_KEY);
  return token;
};

var verifyUser = function verifyUser(req, res, next) {
  console.log('verifyToken');
  verifyToken(req, res, function _callee() {
    var isUser, currentDate;
    return regeneratorRuntime.async(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            isUser = {};

            if (!(req.user.userRole === "Facilities")) {
              _context.next = 7;
              break;
            }

            _context.next = 4;
            return regeneratorRuntime.awrap(Facility.findOne({
              email: req.user.email,
              userRole: req.user.userRole
            }));

          case 4:
            isUser = _context.sent;
            _context.next = 11;
            break;

          case 7:
            if (!(req.user.userRole === "Clinician")) {
              _context.next = 11;
              break;
            }

            _context.next = 10;
            return regeneratorRuntime.awrap(Clinical.findOne({
              email: req.user.email,
              userRole: req.user.userRole
            }));

          case 10:
            isUser = _context.sent;

          case 11:
            // console.log(isUser, req.user)
            if (isUser) {
              currentDate = Math.floor(Date.now() / 1000); // console.log(currentDate);

              if (currentDate < req.user.exp) {
                req.user = isUser; // console.log('user', req.user)

                next();
              } else {
                res.status(401).json({
                  success: false,
                  message: "Token is expired"
                });
              }
            } else res.status(401).json({
              success: false,
              message: "You are not authenticated!"
            });

          case 12:
          case "end":
            return _context.stop();
        }
      }
    });
  });
};

var verifyAdmin = function verifyAdmin(req, res, next) {
  verifyToken(req, res, function () {
    if (req.user.role === 'admin') {
      next();
    } else {
      return res.status(401).json({
        success: false,
        message: "You are not authorized"
      });
    }
  });
};

module.exports = {
  verifyToken: verifyToken,
  verifyUser: verifyUser,
  verifyAdmin: verifyAdmin,
  setToken: setToken
};
//# sourceMappingURL=verifyToken.dev.js.map
