"use strict";

// const app =express();
// app.get("/avatar/:walletAddress", async (req, res) => {
//     const walletAddress = req.params.walletAddress;
//     const connection = new Connection("https://api.devnet.solana.com");
//     try {
//         const publicKey = new PublicKeyCredential(walletAddress);
//         const provider = await connection.getAccountInfo(publicKey);
//         const avatarUrl = `https://arweave.net/${publicKey.toBase58()}`;
//         res.json({avatarUrl});
//     }
// })
var jwtEncode = require('jwt-encode');

var db = require("../models");

var ChatUser = db.chatusers;
app;
//# sourceMappingURL=walletavatar.dev.js.map
