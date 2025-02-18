const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    // origin: "http://localhost:4200", // Allow frontend running on 42000, * will allow any
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  io.emit('userConnected','+'); 
  console.log('A user connected:', socket.id);

  // Listening for newUserInfo from the client
  socket.on('newUserInfo', (msg) => {
    console.log('Received(newUserInfo) message:', msg);
    io.emit('newUserInfo', msg); // Broadcasting message to all clients
  });

  // Listening for updateUserName from the client
  socket.on('updateUserName', (msg) => {
    console.log('Received(updateUserName) message:', msg);
    io.emit('updateUserName', msg); // Broadcasting message to all clients
  });


  // Listening for updateOnlineUserCount from the client
  socket.on('updateOnlineUserCount', (msg) => {
    console.log('Received(updateOnlineUserCount) message:', msg);
    io.emit('updateOnlineUserCount', msg); // Broadcasting message to all clients
  });

  //updateOnlineUseList
  socket.on('updateOnlineUserList', (msg) => {
    console.log('Received(updateOnlineUserList) message:', msg);
    io.emit('updateOnlineUserList', msg); // Broadcasting message to all clients
  });

    // Listening for removeUserInfo from the client
  socket.on('removeUserInfo', (msg) => {
      console.log('Received(removeUserInfo) message:', msg);
      io.emit('removeUserInfo', msg); // Broadcasting message to all clients
  });

  // Listening for chatMessage from the client
  socket.on('chatMessage', (msg) => {
    console.log('Received(chatMessage) message:', msg);
    io.emit('chatMessage', msg); // Broadcasting message to all clients
  });

  socket.on('disconnect', () => {
    io.emit('userDisconnected','-'); 
    console.log('User disconnected:', socket.id);
  });

  // Listening for removeUserInfo from the client
  socket.on('removeUserInfo', (msg) => {
    console.log('Received(removeUserInfo) message:', msg);
    io.emit('removeUserInfo', msg); // Broadcasting message to all clients
  });

  // Listening for userIsTyping from the client
  socket.on('userIsTyping', (msg) => {
    console.log('Received(userIsTyping) message:', msg);
    io.emit('userIsTyping', msg); // Broadcasting message to all clients
  });
  
});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
