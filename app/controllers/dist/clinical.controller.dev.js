"use strict";

var jwtEncode = require('jwt-encode');

var db = require("../models");

var _require = require('../utils/verifyToken'),
    setToken = _require.setToken;

var _require2 = require('mongoose'),
    set = _require2.set;

var Clinical = db.clinical;
var limitAccNum = 100;
var expirationTime = 600; //Regiseter Account

exports.signup = function _callee(req, res) {
  var response, isUser, auth, payload, token;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          console.log("regiester");
          response = req.body; // const accountId = req.params.accountId;

          _context.next = 5;
          return regeneratorRuntime.awrap(Clinical.findOne({
            email: response.email
          }));

        case 5:
          isUser = _context.sent;
          console.log(isUser);

          if (isUser) {
            _context.next = 18;
            break;
          }

          response.entryDate = new Date();
          auth = new Clinical(response);
          _context.next = 12;
          return regeneratorRuntime.awrap(auth.save());

        case 12:
          payload = {
            email: response.email,
            userRole: response.userRole,
            iat: Math.floor(Date.now() / 1000),
            // Issued at time
            exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time

          };
          token = setToken(payload);
          console.log(token);
          res.status(201).json({
            message: "Successfully Regisetered",
            token: token
          });
          _context.next = 19;
          break;

        case 18:
          res.status(409).json({
            message: "The Email is already registered"
          });

        case 19:
          _context.next = 25;
          break;

        case 21:
          _context.prev = 21;
          _context.t0 = _context["catch"](0);
          console.log(_context.t0);
          return _context.abrupt("return", res.status(500).json({
            message: "An Error Occured!"
          }));

        case 25:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 21]]);
}; //Login Account


exports.login = function _callee2(req, res) {
  var _req$body, email, password, userRole, isUser, payload, token, updateUser;

  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          console.log("LogIn");
          _req$body = req.body, email = _req$body.email, password = _req$body.password, userRole = _req$body.userRole;
          _context2.next = 5;
          return regeneratorRuntime.awrap(Clinical.findOne({
            email: email,
            password: password,
            userRole: userRole
          }));

        case 5:
          isUser = _context2.sent;

          if (!isUser) {
            _context2.next = 20;
            break;
          }

          payload = {
            email: isUser.email,
            userRole: isUser.userRole,
            iat: Math.floor(Date.now() / 1000),
            // Issued at time
            exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time

          };
          token = setToken(payload);
          console.log(token);

          if (!token) {
            _context2.next = 17;
            break;
          }

          _context2.next = 13;
          return regeneratorRuntime.awrap(Clinical.updateOne({
            email: email,
            userRole: userRole
          }, {
            $set: {
              logined: true
            }
          }));

        case 13:
          updateUser = _context2.sent;
          res.status(200).json({
            message: "Successfully Logined!",
            token: token,
            user: isUser
          });
          _context2.next = 18;
          break;

        case 17:
          res.status(400).json({
            message: "Cannot logined User!"
          });

        case 18:
          _context2.next = 21;
          break;

        case 20:
          res.status(404).json({
            message: "User Not Found! Please Register First."
          });

        case 21:
          _context2.next = 27;
          break;

        case 23:
          _context2.prev = 23;
          _context2.t0 = _context2["catch"](0);
          console.log(_context2.t0);
          return _context2.abrupt("return", res.status(500).json({
            message: "An Error Occured!"
          }));

        case 27:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 23]]);
}; //Update Account


exports.Update = function _callee3(req, res) {
  var request, user;
  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          console.log('updateSignal');
          request = req.body;
          user = req.user;

          if (user) {
            console.log("items");
            Clinical.findOneAndUpdate({
              user: user
            }, {
              $set: request
            }, {
              "new": false
            }, function (err, updatedDocument) {
              if (err) {
                // Handle the error, e.g., return an error response
                res.status(500).json({
                  error: err
                });
                console.log(err);
              } else {
                console.log("updated", updatedDocument);
                var payload = {
                  email: user.email,
                  userRole: user.userRole,
                  iat: Math.floor(Date.now() / 1000),
                  // Issued at time
                  exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time

                };
                var token = setToken(payload);
                console.log(token); // Document updated successfully, return the updated document as the response

                res.status(200).json({
                  message: 'Trading Signals saved Successfully',
                  token: token,
                  user: updatedDocument
                });
              }
            });
          }

        case 4:
        case "end":
          return _context3.stop();
      }
    }
  });
}; //Logout Account


exports.logout = function _callee4(req, res) {
  var email, logoutUser;
  return regeneratorRuntime.async(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.prev = 0;
          console.log('Logout');
          email = req.body;
          _context4.next = 5;
          return regeneratorRuntime.awrap(Auth.updateOne({
            accountId: accountId
          }, {
            $set: {
              logined: false
            }
          }));

        case 5:
          logoutUser = _context4.sent;
          res.status(200).json({
            email: email,
            logined: logined
          });
          _context4.next = 13;
          break;

        case 9:
          _context4.prev = 9;
          _context4.t0 = _context4["catch"](0);
          console.log(_context4.t0);
          return _context4.abrupt("return", res.status(500).json({
            message: "An Error Occured!"
          }));

        case 13:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[0, 9]]);
};
//# sourceMappingURL=clinical.controller.dev.js.map
