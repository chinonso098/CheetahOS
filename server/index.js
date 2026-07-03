// @ts-check
import express from 'express';
import http from 'http';
// @ts-ignore
import { Server } from 'socket.io';

const PORT = 3000;

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGINS = new Set([
  'https://chinonso098.github.io',
  'http://localhost:4200'
]);

const io = new Server(server, {
  cors: {
    // @ts-ignore
    origin(origin, cb) {
      if (!origin) return cb(null, true); // allow non-browser clients
      cb(null, ALLOWED_ORIGINS.has(origin));
    },
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
// @ts-ignore
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

// @ts-ignore
io.on('connection', (socket) => {
  //console.log('A user connected:', socket.id);
  socketUserMap.set(socket.id, '');

  /**
   * newUserInfo
   * Expected: { userId, userName, userNameAcronym, color }
   */
  // @ts-ignore
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
  // @ts-ignore
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
  // @ts-ignore
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
  // @ts-ignore
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

  socket.on('fetchPriorMessages', (msg) => {
    // Reply to the requesting socket only with the most recent slice of history.
    const mgs = messageList.slice(-asNumber(msg)); // last x messages
    socket.emit('priorMessages', mgs);
  });

});

/** =========================
 * Scheduled history purge
 * ========================= */

// Number of most-recent messages to retain after each purge.
const PURGE_KEEP_LAST = 500;

// Cadence in days; each purge fires at 23:59:00 (11:59pm) local time.
const PURGE_INTERVAL_DAYS = 7;

/**
 * Trim messageList in place down to the most recent PURGE_KEEP_LAST entries.
 * Splicing in place preserves the shared array reference used by the socket
 * handlers (fetchPriorMessages / newMessage), so no re-binding is needed.
 */
function purgeOldMessages() {
  const excess = messageList.length - PURGE_KEEP_LAST;
  if (excess > 0) {
    messageList.splice(0, excess);
    console.log(`purge: trimmed ${excess} message(s); ${messageList.length} kept`);
  }
}

/**
 * Milliseconds from now until the next purge instant: PURGE_INTERVAL_DAYS days
 * ahead at 23:59:00 local time. Recomputed each cycle so the schedule stays
 * anchored to 11:59pm across DST shifts and never accumulates setInterval drift.
 * @returns {number}
 */
function msUntilNextPurge() {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + PURGE_INTERVAL_DAYS);
  next.setHours(23, 59, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

/**
 * Arm a one-shot timer for the next purge instant, then re-arm itself after it
 * fires. Recursive setTimeout (not setInterval) so each cycle re-anchors to
 * 11:59pm. 7 days (~6.05e8 ms) is well within the setTimeout 32-bit limit.
 */
function scheduleWeeklyPurge() {
  setTimeout(() => {
    purgeOldMessages();
    scheduleWeeklyPurge();
  }, msUntilNextPurge());
}

/** =========================
 * Start server
 * ========================= */
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
  console.log(`socket namespace: /chat`);
  scheduleWeeklyPurge();
});