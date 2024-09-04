"use strict";

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

var _require = require("socket.io"),
    Server = _require.Server;

var mongoose = require('mongoose');

var createSocketServer = function createSocketServer(httpServer) {
  var io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  }); // const db = mongoose.connection;

  var db = require("./models");

  var Chat = db.chats;
  var ChatUser = db.chatusers;
  io.on('connection', function (socket) {
    console.log('a user connected'); //-----------------format-------------------------

    socket.on('format', function _callee(message) {
      var walletAddress, filter, update, existingUser;
      return regeneratorRuntime.async(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              walletAddress = message.walletAddress;
              console.log('wallet: ', walletAddress);
              filter = {
                walletAddress: walletAddress
              };
              update = {
                logined: false
              };
              _context.next = 6;
              return regeneratorRuntime.awrap(ChatUser.updateOne(filter, update));

            case 6:
              existingUser = _context.sent;

            case 7:
            case "end":
              return _context.stop();
          }
        }
      });
    }); //-----------------wallet---------------------------

    socket.on('wallet', function _callee3(message) {
      var walletAddress, existingUser, filter, update, result, updateuser, updateMessage;
      return regeneratorRuntime.async(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              // console.log('wallet', message.walletAddress);
              walletAddress = message.walletAddress;
              _context3.next = 3;
              return regeneratorRuntime.awrap(ChatUser.findOne({
                walletAddress: walletAddress
              }));

            case 3:
              existingUser = _context3.sent;

              if (!existingUser) {
                _context3.next = 20;
                break;
              }

              if (!(existingUser.unreadmsg.length > 0)) {
                _context3.next = 20;
                break;
              }

              existingUser.unreadmsg.map(function _callee2(item, index) {
                var reader, _filter, _update, _result, newreader;

                return regeneratorRuntime.async(function _callee2$(_context2) {
                  while (1) {
                    switch (_context2.prev = _context2.next) {
                      case 0:
                        _context2.next = 2;
                        return regeneratorRuntime.awrap(Chat.findOne({
                          id: item
                        }));

                      case 2:
                        reader = _context2.sent;

                        if (!(reader == null)) {
                          _context2.next = 6;
                          break;
                        }

                        _context2.next = 14;
                        break;

                      case 6:
                        _filter = {
                          id: item
                        };
                        _update = {
                          readed: [].concat(_toConsumableArray(reader.readed), [existingUser.username])
                        }; // const update = { readed: [...reader.readed, existing.username] };

                        _context2.next = 10;
                        return regeneratorRuntime.awrap(Chat.updateOne(_filter, _update));

                      case 10:
                        _result = _context2.sent;
                        _context2.next = 13;
                        return regeneratorRuntime.awrap(Chat.findOne({
                          id: item
                        }));

                      case 13:
                        newreader = _context2.sent;

                      case 14:
                      case "end":
                        return _context2.stop();
                    }
                  }
                });
              });
              filter = {
                username: existingUser.username
              };
              update = {
                unreadmsg: []
              };
              _context3.next = 11;
              return regeneratorRuntime.awrap(ChatUser.updateOne(filter, update));

            case 11:
              result = _context3.sent;
              _context3.next = 14;
              return regeneratorRuntime.awrap(ChatUser.findOne({
                username: existingUser.username
              }));

            case 14:
              updateuser = _context3.sent;
              _context3.next = 17;
              return regeneratorRuntime.awrap(Chat.find({}));

            case 17:
              updateMessage = _context3.sent;
              // console.log('readed', updateuser)
              io.emit('checked', updateMessage); // console.log('all:', updateMessage);

              io.emit('Alert', {
                walletAddress: existingUser.walletAddress,
                alert: 0
              });

            case 20:
            case "end":
              return _context3.stop();
          }
        }
      });
    }); //-----------------login-------------------------

    socket.on('login', function _callee5(userData) {
      var existingUser, message, newUser, updateMessages, updateMessage;
      return regeneratorRuntime.async(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              console.log('sdfsfsdf');
              console.log(userData);
              _context5.next = 4;
              return regeneratorRuntime.awrap(ChatUser.findOne({
                username: userData.username
              }));

            case 4:
              existingUser = _context5.sent;
              console.log('existingUser:', existingUser);

              if (!existingUser) {
                _context5.next = 11;
                break;
              }

              message = 'user is already existed.';
              io.to(socket.id).emit('userexist', message);
              _context5.next = 23;
              break;

            case 11:
              newUser = new ChatUser({
                id: socket.id,
                username: userData.username,
                walletAddress: userData.walletAddress,
                avatar: userData.avatarUrl,
                logined: true,
                unreadmsg: []
              });
              newUser.save();
              io.to(socket.id).emit('login', newUser);
              _context5.next = 16;
              return regeneratorRuntime.awrap(Chat.find({}));

            case 16:
              updateMessages = _context5.sent;
              updateMessages.map(function _callee4(item) {
                var filter, update, result;
                return regeneratorRuntime.async(function _callee4$(_context4) {
                  while (1) {
                    switch (_context4.prev = _context4.next) {
                      case 0:
                        filter = {
                          id: item.id
                        };
                        update = {
                          readed: [newUser.username]
                        }; // const update = { readed: [...reader.readed, existing.username] };

                        _context4.next = 4;
                        return regeneratorRuntime.awrap(Chat.updateOne(filter, update));

                      case 4:
                        result = _context4.sent;

                      case 5:
                      case "end":
                        return _context4.stop();
                    }
                  }
                });
              });
              _context5.next = 20;
              return regeneratorRuntime.awrap(Chat.find({}));

            case 20:
              updateMessage = _context5.sent;
              console.log('readed', updateMessage);
              io.emit('checked', updateMessage);

            case 23:
            case "end":
              return _context5.stop();
          }
        }
      });
    }); // socket.on('getmessage', (messageData) => {
    //   const
    // })
    //----------------logout--------------------

    socket.on('logout', function _callee6(message) {
      var filter, update, updateUser;
      return regeneratorRuntime.async(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              filter = {
                username: message.username
              };
              update = {
                logined: message.logined
              };
              _context6.next = 4;
              return regeneratorRuntime.awrap(ChatUser.updateOne(filter, update));

            case 4:
              updateUser = _context6.sent;

            case 5:
            case "end":
              return _context6.stop();
          }
        }
      });
    }); //-----------------message------------------

    socket.on('message', function _callee8(message) {
      var read, ids;
      return regeneratorRuntime.async(function _callee8$(_context8) {
        while (1) {
          switch (_context8.prev = _context8.next) {
            case 0:
              // let messageData;
              // if (message.message instanceof FormData) {
              //   // Handle FormData message
              //   const file = message.get('file');
              //   const fileUrl = await uploadFileToStorage(file);
              //   messageData = { fileUrl };
              // } else {
              //   // Handle string message
              //   messageData = { text: message };
              // }
              // await Message.create(messageData);
              // console.log('New message:', message);
              read = [];
              ids = mongoose.Types.ObjectId();
              ChatUser.aggregate([{
                $match: {
                  logined: true
                }
              }, {
                $project: {
                  _id: 0,
                  username: 1,
                  avatar: 1
                }
              }], function (err, result) {
                if (err) {// Handle error
                } else {
                  // console.log(result);
                  // Process the result
                  result.map(function (item, index) {
                    // console.log(message.username);
                    if (item.username != message.username) read.push(item.username);
                  });
                  console.log(message.username, message.message);
                  var newMessage = new Chat({
                    id: ids,
                    userName: message.username,
                    avatar: message.avatar,
                    message: message.message,
                    image: message.image,
                    timestamp: new Date(),
                    // Save the current server time to the database
                    readed: read
                  });
                  newMessage.save().then(function (data) {
                    console.log('Successfully Created!');
                  }); // const messages = Chat.find({});

                  io.emit('message', newMessage);
                }
              });
              ChatUser.aggregate([{
                $match: {
                  logined: false
                }
              }, {
                $project: {
                  _id: 0,
                  username: 1,
                  unreadmsg: 2
                }
              }], function (err, result) {
                if (err) {// Handle error
                } else {
                  // console.log(result);
                  // Process the result
                  result.map(function _callee7(item, index) {
                    var filter, update, users, user;
                    return regeneratorRuntime.async(function _callee7$(_context7) {
                      while (1) {
                        switch (_context7.prev = _context7.next) {
                          case 0:
                            // console.log(message.username);        
                            filter = {
                              username: item.username
                            };
                            update = {
                              unreadmsg: [].concat(_toConsumableArray(item.unreadmsg), [ids])
                            };
                            _context7.next = 4;
                            return regeneratorRuntime.awrap(ChatUser.updateOne(filter, update));

                          case 4:
                            users = _context7.sent;
                            _context7.next = 7;
                            return regeneratorRuntime.awrap(ChatUser.findOne({
                              username: item.username
                            }));

                          case 7:
                            user = _context7.sent;
                            io.emit('Alert', {
                              walletAddress: user.walletAddress,
                              alert: user.unreadmsg.length
                            });
                            console.log('up', user);

                          case 10:
                          case "end":
                            return _context7.stop();
                        }
                      }
                    });
                  }); // // console.log(read);
                  // const newMessage = new Chat({
                  //   userName: message.username,
                  //   message: message.message,
                  //   timestamp: new Date(), // Save the current server time to the database
                  //   readed: read
                  // });
                  // newMessage.save();
                  // // const messages = Chat.find({});
                  // io.emit('message', newMessage);
                }
              }); // console.log('message: ', message);

            case 4:
            case "end":
              return _context8.stop();
          }
        }
      });
    });
    socket.on('upload', function (message) {
      var read = [];
      var ids = mongoose.Types.ObjectId();
      ChatUser.aggregate([{
        $match: {
          logined: true
        }
      }, {
        $project: {
          _id: 0,
          username: 1,
          avatar: 2
        }
      }], function (err, result) {
        if (err) {// Handle error
        } else {
          // console.log(result);
          // Process the result
          result.map(function (item, index) {
            // console.log(message.username);
            if (item.username != message.username) read.push(item.username);
          }); // console.log(read);

          var newMessage = new Chat({
            id: ids,
            userName: message.username,
            avatar: message.avatar,
            message: message.message,
            timestamp: new Date(),
            // Save the current server time to the database
            readed: read
          });
          newMessage.save(); // const messages = Chat.find({});

          io.emit('message', newMessage);
        }
      });
      ChatUser.aggregate([{
        $match: {
          logined: false
        }
      }, {
        $project: {
          _id: 0,
          username: 1,
          unreadmsg: 2
        }
      }], function (err, result) {
        if (err) {// Handle error
        } else {
          // console.log(result);
          // Process the result
          result.map(function _callee9(item, index) {
            var filter, update, users, user;
            return regeneratorRuntime.async(function _callee9$(_context9) {
              while (1) {
                switch (_context9.prev = _context9.next) {
                  case 0:
                    // console.log(message.username);        
                    filter = {
                      username: item.username
                    };
                    update = {
                      unreadmsg: [].concat(_toConsumableArray(item.unreadmsg), [ids])
                    };
                    _context9.next = 4;
                    return regeneratorRuntime.awrap(ChatUser.updateOne(filter, update));

                  case 4:
                    users = _context9.sent;
                    _context9.next = 7;
                    return regeneratorRuntime.awrap(ChatUser.findOne({
                      username: item.username
                    }));

                  case 7:
                    user = _context9.sent;
                    io.emit('Alert', {
                      walletAddress: user.walletAddress,
                      alert: user.unreadmsg.length
                    });
                    console.log('up', user);

                  case 10:
                  case "end":
                    return _context9.stop();
                }
              }
            });
          }); // // console.log(read);
          // const newMessage = new Chat({
          //   userName: message.username,
          //   message: message.message,
          //   timestamp: new Date(), // Save the current server time to the database
          //   readed: read
          // });
          // newMessage.save();
          // // const messages = Chat.find({});
          // io.emit('message', newMessage);
        }
      });
    });
    socket.on('disconnect', function () {
      console.log('Client disconnected');
    });
  }); // const PORT = 8080;
  // httpServer.listen(PORT, () => {
  //   console.log(`Socket.IO server is running on port ${PORT}`);
  // });
};

module.exports = createSocketServer;
//# sourceMappingURL=socketServer.dev.js.map
