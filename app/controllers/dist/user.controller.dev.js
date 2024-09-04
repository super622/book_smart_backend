"use strict";

var jwtEncode = require('jwt-encode');

var db = require("../models");

var User = db.users;
var secret = 'secret'; // Create and Save a new user

exports.create = function _callee(req, res) {
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          User.find({}).then(function (data) {
            res.send(data);
          })["catch"](function (err) {
            res.status(500).send({
              message: err.message || "Some error occurred while retrieving spots."
            });
          });
          User.find({
            email: req.body.email
          }).then(function (data) {
            if (data.length === 0) {
              var user = new User({
                id: req.body.id,
                email: req.body.email,
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                password: req.body.password,
                authToken: req.body.authToken,
                userId: req.body.userId
              });
              user.save(user);
            } else return;
          })["catch"](function (err) {
            res.status(500).send({
              message: err.message || "Some error occurred while retrieving spots."
            });
          }); //   const user = new User({
          //     // walletAddress: req.body.data.walletAddress,
          //     id: req.body.id,
          //     email: req.body.email,
          //     firstName: req.body.firstName,
          //     lastName: req.body.lastName,
          //     password: req.body.password,
          //   });
          //   user.save(user)

        case 2:
        case "end":
          return _context.stop();
      }
    }
  });
};

exports.login = function _callee2(req, res) {
  var iat, exp;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          iat = req.body.time;
          exp = req.body.time + 600;
          User.find({
            email: req.body.email
          }).then(function (data) {
            if (data.length === 0) {
              res.send('There is no user');
            } else if (data[0].password !== req.body.password) {
              res.send('Wrong Password');
            } else {
              var userId = data[0].id;
              var serviceToken = jwtEncode({
                userId: userId,
                iat: iat,
                exp: exp
              }, secret);
              var user = {
                email: data[0].email,
                id: data[0]._id,
                name: "".concat(data[0].firstName, " ").concat(data[0].lastName),
                userId: data[0].userId,
                authToken: data[0].authToken
              };
              var response = {
                serviceToken: serviceToken,
                user: user
              };
              res.send(response);
            }
          })["catch"](function (err) {
            res.status(500).send({
              message: err.message || "Some error occurred while retrieving spots."
            });
          });

        case 3:
        case "end":
          return _context2.stop();
      }
    }
  });
};
//# sourceMappingURL=user.controller.dev.js.map
