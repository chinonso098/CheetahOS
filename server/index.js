// @ts-check
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

// @ts-ignore
const PORT = 3000;
const app = express();
const server = http.createServer(app);

// @ts-ignore
const io = new Server(server, {
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

/** @type {import('../server/chat.types').NewMessage[]} */
const messageList = [];

/** @type {Map<string, string>} */
// @ts-ignore
const socketUserMap = new Map(); // socket.id -> userId


// @ts-ignore
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socketUserMap.set(socket.id, '');

  // Listening for newUserInfo from the client
  // @ts-ignore
  socket.on('newUserInfo', (msg) => {
    if (!msg || typeof msg !== 'object' || !msg.userId || !msg.userName) return;

    /** @type {import('../server/chat.types').UserData} */
    const user = {
      userId: msg.userId,
      userName: msg.userName,
      userNameAcronym: msg.userNameAcronym,
      color: msg.color,
      isTyping: false // Best to initialize as false
    };

    // 1. Update the Global List
    const exists = onlineUserList.onlineUsers.some(u => u.userId === user.userId);
    if(!exists)
      onlineUserList.onlineUsers.push(user);
    
    // 2. Map the current socket to this user
    if(socketUserMap.has(socket.id)){
      socketUserMap.set(socket.id, user.userId);

      console.log('full list for new user:', onlineUserList.onlineUsers);
      // 3. To the NEW user: Send the full list of everyone ELSE
      const others = onlineUserList.onlineUsers.filter(u => u.userId !== user.userId);
      socket.emit('updateOnlineUserList', others); 

      // 4. To EVERYONE ELSE: Send only the new user info
      console.log('Received(newUserInfo) message:', user);
      socket.broadcast.emit('newUserInfo', user); 
    }

    // 5. To EVERYONE: Update the total count
    io.emit('updateOnlineUserCount', {
      timeStamp: Date.now(),
      userCount: onlineUserList.onlineUsers.length
    });
  });

  // Listening for updateUserName from the client
  // @ts-ignore
  socket.on('updateUserName', (msg) => {
    const user = onlineUserList.onlineUsers.find(u => u.userId === msg.userId);
    if(!user) return;

    user.userName = msg.userName
    user.userNameAcronym = msg.userNameAcronym

    console.log('Received(updateUserName) message:', user);

    socket.broadcast.emit('updateUserName', msg); // Broadcasting message to all clients
  });

  // Listening for newMessage from the client
  // @ts-ignore
  socket.on('newMessage', (msg) => {
    /** @type {import('../server/chat.types').NewMessage} */
    const chat = {
      msg: msg._msg,
      userId: msg._userId,
      userName: msg._userName,
      userNameAcronym: msg._userNameAcronym,
      timestamp: Date.now(),
      iconColor: '',
      isAppMsg: msg._isAppMsg,
      isUserNameEdit: msg._isUserNameEdit
    }

    messageList.push(chat);
    console.log('Received(newMessage) message:', msg);
    console.log('messageList:', messageList);
    socket.broadcast.emit('newMessage', msg); // Broadcasting message to all other client
  });

  socket.on('disconnect', () =>{
    const userId = socketUserMap.get(socket.id);
    if (!userId) return;

    // Remove from onlineUserList
    // @ts-ignore
    onlineUserList.onlineUsers = onlineUserList.onlineUsers.filter(user => user.userId !== userId);

    // Cleanup map
    socketUserMap.delete(socket.id);

    io.emit('removeUserInfo', userId); // Broadcasting message to all clients

    //To EVERYONE: Update the total count
    io.emit('updateOnlineUserCount', {
      timeStamp: Date.now(),
      userCount: onlineUserList.onlineUsers.length
    });

    console.log('User disconnected:', socket.id);
  });


  // Listening for userTypingState from the client
  // @ts-ignore
  socket.on('userTypingState', (msg) => {
    const userId = socketUserMap.get(socket.id);
    if (!userId) return;

    const user = onlineUserList.onlineUsers.find(u => u.userId === userId);
    if(!user) return;

    console.log('userTypingState:', msg);

    user.isTyping = msg ;
    console.log('Received(userTypingState) message:', user);

    if(msg === true)
      socket.broadcast.emit('userIsTyping', userId); // Broadcast message to all other clients
    else
      socket.broadcast.emit('userStoppedTyping', userId); // Broadcast message to all other clients
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