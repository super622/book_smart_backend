"use strict";

var jwtEncode = require('jwt-encode');

var db = require("../models");

var _require = require('../utils/verifyToken'),
    setToken = _require.setToken;

var _require2 = require('mongoose'),
    set = _require2.set;

var Job = db.jobs;
var limitAccNum = 100;
var expirationTime = 600; //Regiseter Account

exports.postJob = function _callee(req, res) {
  var lastJob, lastJobId, newJobId, response, user, isUser, auth, payload, token;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          console.log("register");
          _context.next = 4;
          return regeneratorRuntime.awrap(Job.find().sort({
            jobId: -1
          }).limit(1));

        case 4:
          lastJob = _context.sent;
          // Retrieve the last jobId
          lastJobId = lastJob.length > 0 ? lastJob[0].jobId : 0; // Get the last jobId value or default to 0

          newJobId = lastJobId + 1; // Increment the last jobId by 1 to set the new jobId for the next data entry

          response = req.body;
          user = req.user;
          console.log("new Id------------->", newJobId); // const accountId = req.params.accountId;

          _context.next = 12;
          return regeneratorRuntime.awrap(Job.findOne({
            jobId: newJobId
          }));

        case 12:
          isUser = _context.sent;
          console.log(isUser);

          if (isUser) {
            _context.next = 26;
            break;
          }

          response.entryDate = new Date();
          response.jobId = newJobId;
          auth = new Job(response);
          _context.next = 20;
          return regeneratorRuntime.awrap(auth.save());

        case 20:
          payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000),
            // Issued at time
            exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time

          };
          token = setToken(payload);
          console.log(token);
          res.status(201).json({
            message: "Successfully Registered",
            token: token
          });
          _context.next = 27;
          break;

        case 26:
          res.status(409).json({
            message: "The Email is already registered"
          });

        case 27:
          _context.next = 33;
          break;

        case 29:
          _context.prev = 29;
          _context.t0 = _context["catch"](0);
          console.log(_context.t0);
          return _context.abrupt("return", res.status(500).json({
            message: "An Error Occured!"
          }));

        case 33:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 29]]);
}; //Login Account


exports.shifts = function _callee2(req, res) {
  var user, isUser, payload, token, updateUser;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          console.log("LogIn");
          user = req.user;
          _context2.next = 5;
          return regeneratorRuntime.awrap(Job.find({}));

        case 5:
          isUser = _context2.sent;

          if (!isUser) {
            _context2.next = 20;
            break;
          }

          payload = {
            email: user.email,
            userRole: user.userRole,
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
          return regeneratorRuntime.awrap(Job.updateOne({
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
            message: "Successfully Get!",
            Data: isUser,
            token: token,
            user: user
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
};
//# sourceMappingURL=job.controller.dev.js.map
