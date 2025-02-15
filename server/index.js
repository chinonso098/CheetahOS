const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:4200", // Allow frontend running on 42000, * will allow any
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Listening for messages from the client
  socket.on('message', (msg) => {
    console.log('Received message:', msg);
    io.emit('message', msg); // Broadcasting message to all clients
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

});

server.listen(3000, () => {
  console.log('listening on *:3000');
});
