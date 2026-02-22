// @ts-check
import express from 'express';
import { createServer } from 'http';
import socketIo from 'socket.io';

// @ts-ignore
const PORT = 3000;
const app = express();
const server = createServer(app);

// @ts-ignore
const io = socketIo(server, {
  cors: {
    // origin: "http://localhost:4200", // Allow frontend running on 42000, * will allow any
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

/** @type {import('../server/chat.types').UserList} */
  const onlineUserList = {
    timeStamp: Date.now(),
    onlineUsers: []
  };

/** @type {import('../server/chat.types').ChatMessage[]} */
const messageList = [];

/** @type {Map<string, string>} */
// @ts-ignore
const socketUserMap = new Map(); // socket.id -> userId

/** @type {Set<string>} */
const initializedSockets = new Set();


// @ts-ignore
io.on('connection', (socket) => {
  io.emit('userConnected','+'); 
  console.log('A user connected:', socket.id);
  initializedSockets.add(socket.id);

  // Listening for newUserInfo from the client
  // @ts-ignore
  socket.on('newUserInfo', (msg) => {
    /** @type {import('../server/chat.types').UserData} */
    const user = {
      userId: msg.userId,
      userName: msg.userName,
      userNameAcronym: msg.userNameAcronym,
      color: msg.color,
      isTyping: msg.isTyping
    };

    // Prevent duplicates (important)
    const exists = onlineUserList.onlineUsers.some(u => u.userId === user.userId);
    if (!exists)
      onlineUserList.onlineUsers.push(user);

    const isSocketIdPresent = socketUserMap.has(socket.id);
    if(!isSocketIdPresent){
      // Match socket id to user id
      socketUserMap.set(socket.id, user.userId);

      console.log('full list for new user:', onlineUserList.onlineUsers);
      ///If it is a new user joining for the first time, then the new user get the onlineUsers list.
      io.emit('onlineUserList', onlineUserList.onlineUsers); // Broadcasting message to all clients
    }
  

    console.log('Received(newUserInfo) message:', user);
    // for other existing users, they only get the new user
    io.emit('newUserInfo', msg); // Broadcasting message to all clients
  });

  // Listening for updateUserName from the client
  // @ts-ignore
  socket.on('updateUserName', (msg) => {
    const user = onlineUserList.onlineUsers.find(u => u.userId === msg.userId);
    if(!user) return;

    user.userName = msg.userName
    user.userNameAcronym = msg.userNameAcronym

    console.log('Received(updateUserName) message:', user);

    io.emit('updateUserName', msg); // Broadcasting message to all clients
  });


  // Listening for updateOnlineUserCount from the client
  // @ts-ignore
  socket.on('updateOnlineUserCount', (msg) => {
    /** @type {import('../server/chat.types').UserCount} */
    const usrCount = {
      timeStamp: Date.now(),
      userCount: onlineUserList.onlineUsers.length
    }

    console.log('Received(updateOnlineUserCount) message:', msg);
    io.emit('updateOnlineUserCount', msg); // Broadcasting message to all clients
  });

  //updateOnlineUseList
  // @ts-ignore
  socket.on('updateOnlineUserList', (msg) => {
    console.log('Received(updateOnlineUserList) message:', msg);
    io.emit('updateOnlineUserList', msg); // Broadcasting message to all clients
  });

  // Listening for removeUserInfo from the client
  // @ts-ignore
  socket.on('removeUserInfo', (msg) => {
      console.log('Received(removeUserInfo) message:', msg);

      // Remove from list
      // @ts-ignore
      list.onlineUsers = list.onlineUsers.filter(user => user.userId !== msg.userId);

      io.emit('removeUserInfo', msg); // Broadcasting message to all clients
  });

  // Listening for chatMessage from the client
  // @ts-ignore
  socket.on('chatMessage', (msg) => {
    /** @type {import('../server/chat.types').ChatMessage} */
    const chat = {
      msg: msg.msg,
      userId: msg.userId,
      userName: msg.userName,
      userNameAcronym: msg.userNameAcronym,
      timestamp: Date.now(),
      iconColor: '',
      isAppMsg: msg.isAppMsg,
      isUserNameEdit: msg.isUserNameEdit
    }

    messageList.push(chat);
    console.log('Received(chatMessage) message:', msg);


    io.emit('chatMessage', msg); // Broadcasting message to all clients
  });

  socket.on('disconnect', () => {
    io.emit('userDisconnected','-'); 

    const userId = socketUserMap.get(socket.id);
    if (!userId) return;

    // Cleanup map
    socketUserMap.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });


  // Listening for userIsTyping from the client
  // @ts-ignore
  socket.on('userIsTyping', (msg) => {
    //console.log('Received(userIsTyping) message:', msg);

    const user = onlineUserList.onlineUsers.find(u => u.userId === msg.userId);
    if(!user) return;

    user.isTyping = msg.isTyping
    console.log('Received(userIsTyping) message:', user);
    io.emit('userIsTyping', msg); // Broadcasting message to all clients
  });
  
});

/**
 * =========================
 * Start server
 * =========================
 */

server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
  console.log(`socket namespace: /chat`);
});