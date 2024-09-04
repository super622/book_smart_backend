const { Server } = require("socket.io");
const mongoose = require('mongoose');

const createSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
// const db = mongoose.connection;
const db = require("./models");
const Chat = db.chats;
const ChatUser = db.chatusers

io.on('connection', (socket) => {
  console.log('a user connected');
  //-----------------format-------------------------
  socket.on('format', async(message) => {
    const walletAddress = message.walletAddress;
    console.log('wallet: ', walletAddress);
    const filter = {walletAddress: walletAddress};
    const update = {logined: false};
    const existingUser = await ChatUser.updateOne(filter, update);
  })


  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// const PORT = 8080;
// httpServer.listen(PORT, () => {
//   console.log(`Socket.IO server is running on port ${PORT}`);
// });
}
module.exports = createSocketServer;
