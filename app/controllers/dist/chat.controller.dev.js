"use strict";

var jwtEncode = require('jwt-encode');

var db = require("../models");

var ChatUser = db.chatusers;
var Chat = db.chats;
var secret = 'secret';

exports.wallet = function _callee(req, res) {
  var walletAddress, existingUser, filter, update, result;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          walletAddress = req.body.walletAddress; // console.log(req.body);

          _context.prev = 1;
          _context.next = 4;
          return regeneratorRuntime.awrap(ChatUser.findOne({
            walletAddress: walletAddress
          }));

        case 4:
          existingUser = _context.sent;

          if (!existingUser) {
            _context.next = 14;
            break;
          }

          // const updateUser = ChatUser.updateOne({username:username, logined: true});
          // console.log('log', updateUser.logined);
          // console.log('user', existingUser.logined);
          filter = {
            username: existingUser.username
          };
          update = {
            logined: true
          };
          _context.next = 10;
          return regeneratorRuntime.awrap(ChatUser.updateOne(filter, update));

        case 10:
          result = _context.sent;
          return _context.abrupt("return", res.status(200).json({
            isWalletLogin: 'true',
            username: existingUser.username
          }));

        case 14:
          return _context.abrupt("return", res.status(200).json({
            isWalletLogin: false
          }));

        case 15:
          _context.next = 20;
          break;

        case 17:
          _context.prev = 17;
          _context.t0 = _context["catch"](1);
          res.status(500).json({
            message: 'An error occurred'
          });

        case 20:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[1, 17]]);
}; // Create and Save a new user


exports.create = function _callee2(req, res) {
  var _req$body, username, walletAddress, existingUser, updateUser, newUser;

  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _req$body = req.body, username = _req$body.username, walletAddress = _req$body.walletAddress;
          console.log(username, walletAddress);
          _context2.prev = 2;
          _context2.next = 5;
          return regeneratorRuntime.awrap(ChatUser.findOne({
            username: username
          }));

        case 5:
          existingUser = _context2.sent;
          console.log(existingUser);

          if (!existingUser) {
            _context2.next = 11;
            break;
          }

          updateUser = ChatUser.updateOne({
            username: username,
            logined: true
          });
          console.log('log', updateUser.logined);
          return _context2.abrupt("return", res.status(400).json({
            message: 'Username is already taken'
          }));

        case 11:
          newUser = new ChatUser({
            username: username,
            walletAddress: walletAddress,
            logined: true,
            unread: unread
          });
          console.log(newUser);
          _context2.next = 15;
          return regeneratorRuntime.awrap(newUser.save());

        case 15:
          res.status(201).json(newUser);
          _context2.next = 21;
          break;

        case 18:
          _context2.prev = 18;
          _context2.t0 = _context2["catch"](2);
          res.status(500).json({
            message: 'An error occurred'
          });

        case 21:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[2, 18]]);
};

exports.getMessage = function _callee3(req, res) {
  var AllMessages;
  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _context3.next = 3;
          return regeneratorRuntime.awrap(Chat.find({}));

        case 3:
          AllMessages = _context3.sent;

          if (AllMessages) {
            _context3.next = 6;
            break;
          }

          return _context3.abrupt("return", res.status(400).json({
            message: "No messages"
          }));

        case 6:
          return _context3.abrupt("return", res.status(200).json({
            message: AllMessages
          }));

        case 9:
          _context3.prev = 9;
          _context3.t0 = _context3["catch"](0);
          res.status(500).json({
            message: 'An error occurred'
          });

        case 12:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 9]]);
}; // exports.login = async (req, res) => {
//   const iat = req.body.time
//   const exp = req.body.time + 600
//   User.find({ email: req.body.email })
//     .then((data) => {
//       if (data.length === 0) {
//         res.send('There is no user')
//       } else if(data[0].password !== req.body.password){
//         res.send('Wrong Password')
//       }
//        else {
//         const userId = data[0].id
//         const serviceToken = jwtEncode({
//           userId: userId,
//           iat: iat,
//           exp: exp
//         }, secret)
//         const user = {
//           email: data[0].email,
//           id: data[0]._id,
//           name:`${data[0].firstName} ${data[0].lastName}`,
//           userId: data[0].userId,
//           authToken: data[0].authToken
//         }
//         const response = {
//           serviceToken:serviceToken,
//           user:user
//         }
//         res.send(response)
//       }
//     })
//     .catch((err) => {
//       res.status(500).send({
//         message: err.message || "Some error occurred while retrieving spots.",
//       });
//     });
// };
//# sourceMappingURL=chat.controller.dev.js.map
