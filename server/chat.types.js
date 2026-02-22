// @ts-check
export {};

/**
 * @typedef {Object} ChatMessage
 * @property {string} msg
 * @property {string} userId
 * @property {string} userName
 * @property {string} userNameAcronym
 * @property {number} timestamp
 * @property {string} iconColor
 * @property {boolean} isUserNameEdit
 * @property {boolean} isAppMsg
 */


/**
 * @typedef {Object} User
 * @property {string} firstName
 * @property {string} lastName
 */

/**
 * @typedef {Object} UserData
 * @property {string} userId
 * @property {string} userName
 * @property {string} userNameAcronym
 * @property {string} color
 * @property {boolean} isTyping
 */

/**
 * @typedef {Object} UserList
 * @property {number} timeStamp
 * @property {UserData[]} onlineUsers
 */


/**
 * @typedef {Object} UserCount
 * @property {number} timeStamp
 * @property {number} userCount
 */