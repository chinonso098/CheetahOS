// @ts-check
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const PORT = 3000;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
      // origin: "http://localhost:4200", // Allow frontend running on 42000, * will allow any
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

/** =========================
 * Runtime helpers (tiny, fast)
 * ========================= */

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function asString(v) {
  return typeof v === 'string' ? v : '';
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function asNonEmptyString(v) {
  const s = asString(v).trim();
  return s.length ? s : '';
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function asBool(v) {
  return typeof v === 'boolean' ? v : false;
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function asNumber(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** =========================
 * In-memory state
 * ========================= */

/** @type {import('../server/chat.types').UserList} */
const onlineUserList = {
  timeStamp: Date.now(),
  onlineUsers: [],
};

/** @type {import('../server/chat.types').NewMessage[]} */
const messageList = [];

/** @type {Map<string, string>} */
const socketUserMap = new Map(); // socket.id -> userId

/** =========================
 * Socket events
 * ========================= */

io.on('connection', (socket) => {
  //console.log('A user connected:', socket.id);
  socketUserMap.set(socket.id, '');

  /**
   * newUserInfo
   * Expected: { userId, userName, userNameAcronym, color }
   */
  socket.on('newUserInfo', (msg) => {
    if (!isPlainObject(msg)) return;

    const userId = asNonEmptyString(msg.userId);
    const userName = asNonEmptyString(msg.userName);
    if (!userId || !userName) return;

    /** @type {import('../server/chat.types').UserData} */
    const user = {
      userId,
      userName,
      userNameAcronym: asString(msg.userNameAcronym),
      color: asString(msg.color),
      isTyping: false,
    };

    // 1) Update the global list (idempotent)
    const exists = onlineUserList.onlineUsers.some((u) => u.userId === user.userId);
    if (!exists) onlineUserList.onlineUsers.push(user);

    // 2) Map socket -> userId
    socketUserMap.set(socket.id, user.userId);

    // 3) To the NEW user: send the list of everyone ELSE
    const others = onlineUserList.onlineUsers.filter((u) => u.userId !== user.userId);
    socket.emit('updateOnlineUserList', others);

    // 4) To EVERYONE ELSE: send only the new user info
    socket.broadcast.emit('newUserInfo', user);

    // 5) To EVERYONE: update total count
    io.emit('updateOnlineUserCount', {
      timeStamp: Date.now(),
      userCount: onlineUserList.onlineUsers.length,
    });
  });

  /**
   * updateUserName
   * Expected: { userId, userName, userNameAcronym }
   */
  socket.on('updateUserName', (msg) => {
    if (!isPlainObject(msg)) return;

    const userId = asNonEmptyString(msg.userId);
    const userName = asNonEmptyString(msg.userName);
    const userNameAcronym = asString(msg.userNameAcronym);

    if (!userId || !userName) return;

    const user = onlineUserList.onlineUsers.find((u) => u.userId === userId);
    if (!user) return;

    user.userName = userName;
    user.userNameAcronym = userNameAcronym;

    socket.broadcast.emit('updateUserName', {
      userId,
      userName,
      userNameAcronym,
      color: user.color,
      isTyping: user.isTyping,
    });
  });

  /**
   * newMessage
   * Client currently sends underscore fields (ChatMessage instance-like).
   * We ACCEPT:
   * - msg._msg style (current)
   * - msg.msg style (optional)
   *
   * IMPORTANT: To avoid breaking clients, we KEEP broadcasting the original msg.
   */
  socket.on('newMessage', (msg) => {
    if (!isPlainObject(msg)) return;

    // Accept both styles: underscore or flat.
    const rawMsg = asNonEmptyString(msg._msg);
    const rawUserId = asNonEmptyString(msg._userId);
    const rawUserName = asNonEmptyString(msg._userName);

    // Minimal validity; avoid poisoning history with garbage.
    if (!rawMsg || !rawUserId || !rawUserName) return;

    /** @type {import('../server/chat.types').NewMessage} */
    const chat = {
      msg: rawMsg,
      userId: rawUserId,
      userName: rawUserName,
      userNameAcronym: asString(msg._userNameAcronym),
      timestamp: Date.now(),
      iconColor: asString(msg._iconColor),
      isAppMsg: asBool(msg._isAppMsg),
      isUserNameEdit: asBool(msg._isUserNameEdit),
    };

    messageList.push(chat);
    
    // Keep your existing contract: broadcast original msg object (underscore shape)
    socket.broadcast.emit('newMessage', msg);
  });

  /**
   * userTypingState
   * Expected: boolean (true/false)
   */
  socket.on('userTypingState', (msg) => {
    const userId = socketUserMap.get(socket.id);
    if (!userId) return;

    const user = onlineUserList.onlineUsers.find((u) => u.userId === userId);
    if (!user) return;

    const isTyping = typeof msg === 'boolean' ? msg : false;
    user.isTyping = isTyping;

    if (isTyping) socket.broadcast.emit('userIsTyping', userId);
    else socket.broadcast.emit('userStoppedTyping', userId);
  });

  socket.on('disconnect', () => {
    const userId = socketUserMap.get(socket.id);
    socketUserMap.delete(socket.id);

    if (!userId) {
      console.log('User disconnected (no mapped user):', socket.id);
      return;
    }

    // Remove from online list
    onlineUserList.onlineUsers = onlineUserList.onlineUsers.filter((u) => u.userId !== userId);

    io.emit('removeUserInfo', userId);

    io.emit('updateOnlineUserCount', {
      timeStamp: Date.now(),
      userCount: onlineUserList.onlineUsers.length,
    });

    //console.log('User disconnected:', socket.id);
  });
});

/** =========================
 * Start server
 * ========================= */
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
  console.log(`socket namespace: /chat`);
});