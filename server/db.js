const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'skillshare.db');
let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      bio TEXT DEFAULT '',
      teach_skills TEXT DEFAULT '[]',
      learn_skills TEXT DEFAULT '[]',
      avatar_url TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      body TEXT NOT NULL,
      skill_tag TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS likes (
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organizer_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      skill_tag TEXT NOT NULL,
      description TEXT DEFAULT '',
      scheduled_at DATETIME NOT NULL,
      duration INTEGER DEFAULT 60,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  saveDB();
  return db;
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  const id = queryOne('SELECT last_insert_rowid() as id').id;
  saveDB();
  return id;
}

function createUser(username, password) {
  const hash = bcrypt.hashSync(password, 10);
  return run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hash]);
}

function verifyUser(username, password) {
  const user = queryOne('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;
  return { id: user.id, username: user.username };
}

function getUser(id) {
  const user = queryOne('SELECT id, username, bio, teach_skills, learn_skills, avatar_url, created_at FROM users WHERE id = ?', [id]);
  if (user) {
    user.teach_skills = JSON.parse(user.teach_skills || '[]');
    user.learn_skills = JSON.parse(user.learn_skills || '[]');
  }
  return user;
}

function updateUser(id, data) {
  const fields = [];
  const values = [];
  if (data.bio !== undefined) { fields.push('bio = ?'); values.push(data.bio); }
  if (data.teach_skills !== undefined) { fields.push('teach_skills = ?'); values.push(JSON.stringify(data.teach_skills)); }
  if (data.learn_skills !== undefined) { fields.push('learn_skills = ?'); values.push(JSON.stringify(data.learn_skills)); }
  if (fields.length === 0) return;
  values.push(id);
  db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
  saveDB();
}

function createPost(authorId, type, body, skillTag, category) {
  return run('INSERT INTO posts (author_id, type, body, skill_tag, category) VALUES (?, ?, ?, ?, ?)', [authorId, type, body, skillTag, category]);
}

function getPosts(category) {
  let sql = `
    SELECT p.*, u.username as author_name,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
    FROM posts p JOIN users u ON p.author_id = u.id
  `;
  const params = [];
  if (category && category !== 'all') {
    sql += ' WHERE p.category = ?';
    params.push(category);
  }
  sql += ' ORDER BY p.created_at DESC';
  return queryAll(sql, params);
}

function getPostsByUser(userId) {
  return queryAll(`
    SELECT p.*, u.username as author_name,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
    FROM posts p JOIN users u ON p.author_id = u.id
    WHERE p.author_id = ?
    ORDER BY p.created_at DESC
  `, [userId]);
}

function toggleLike(userId, postId) {
  const existing = queryOne('SELECT * FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId]);
  if (existing) {
    db.run('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [userId, postId]);
    saveDB();
    return false;
  } else {
    run('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [userId, postId]);
    return true;
  }
}

function getLikedPosts(userId) {
  return queryAll('SELECT post_id FROM likes WHERE user_id = ?', [userId]).map(r => r.post_id);
}

function addComment(authorId, postId, body) {
  return run('INSERT INTO comments (author_id, post_id, body) VALUES (?, ?, ?)', [authorId, postId, body]);
}

function getComments(postId) {
  return queryAll(`
    SELECT c.*, u.username as author_name
    FROM comments c JOIN users u ON c.author_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `, [postId]);
}

function deletePost(userId, postId) {
  db.run('DELETE FROM posts WHERE id = ? AND author_id = ?', [postId, userId]);
  saveDB();
}

function getOrCreateConversation(userId1, userId2) {
  const existing = queryOne(`
    SELECT c.id FROM conversations c
    JOIN conversation_members m1 ON c.id = m1.conversation_id AND m1.user_id = ?
    JOIN conversation_members m2 ON c.id = m2.conversation_id AND m2.user_id = ?
  `, [userId1, userId2]);
  if (existing) return existing.id;
  const convId = run('INSERT INTO conversations DEFAULT VALUES');
  run('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', [convId, userId1]);
  run('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)', [convId, userId2]);
  return convId;
}

function getUserConversations(userId) {
  return queryAll(`
    SELECT c.id, c.created_at,
      (SELECT u.username FROM users u JOIN conversation_members m ON u.id = m.user_id WHERE m.conversation_id = c.id AND m.user_id != ?) as other_name,
      (SELECT u.id FROM users u JOIN conversation_members m ON u.id = m.user_id WHERE m.conversation_id = c.id AND m.user_id != ?) as other_id,
      (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT sender_id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_sender,
      (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != ? AND id > COALESCE((SELECT MAX(id) FROM messages WHERE conversation_id = c.id AND sender_id = ?), 0)) as unread
    FROM conversations c
    JOIN conversation_members cm ON c.id = cm.conversation_id
    WHERE cm.user_id = ?
    ORDER BY last_message_at DESC
  `, [userId, userId, userId, userId, userId]);
}

function getMessages(convId, userId) {
  return queryAll(`
    SELECT m.*, u.username as sender_name
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `, [convId]);
}

function sendMessage(convId, senderId, body) {
  return run('INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)', [convId, senderId, body]);
}

function isConversationMember(convId, userId) {
  return !!queryOne('SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [convId, userId]);
}

function searchUsers(query, excludeId) {
  return queryAll('SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 10', ['%' + query + '%', excludeId]);
}

function deleteComment(userId, commentId) {
  db.run('DELETE FROM comments WHERE id = ? AND author_id = ?', [commentId, userId]);
  saveDB();
}

function createSession(organizerId, participantId, skillTag, description, scheduledAt, duration) {
  return run('INSERT INTO sessions (organizer_id, participant_id, skill_tag, description, scheduled_at, duration) VALUES (?, ?, ?, ?, ?, ?)', [organizerId, participantId, skillTag, description, scheduledAt, duration || 60]);
}

function getUserSessions(userId) {
  return queryAll(`
    SELECT s.*,
      u1.username as organizer_name,
      u2.username as participant_name
    FROM sessions s
    JOIN users u1 ON s.organizer_id = u1.id
    JOIN users u2 ON s.participant_id = u2.id
    WHERE s.organizer_id = ? OR s.participant_id = ?
    ORDER BY s.scheduled_at ASC
  `, [userId, userId]);
}

function updateSessionStatus(sessionId, userId, status) {
  const session = queryOne('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  if (!session) return null;
  if (session.organizer_id !== userId && session.participant_id !== userId) return null;
  db.run('UPDATE sessions SET status = ? WHERE id = ?', [status, sessionId]);
  saveDB();
  return queryOne('SELECT s.*, u1.username as organizer_name, u2.username as participant_name FROM sessions s JOIN users u1 ON s.organizer_id = u1.id JOIN users u2 ON s.participant_id = u2.id WHERE s.id = ?', [sessionId]);
}

function deleteSession(sessionId, userId) {
  const session = queryOne('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  if (!session) return false;
  if (session.organizer_id !== userId && session.participant_id !== userId) return false;
  db.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
  saveDB();
  return true;
}

module.exports = { initDB, createUser, verifyUser, getUser, updateUser, createPost, getPosts, getPostsByUser, toggleLike, getLikedPosts, addComment, getComments, deleteComment, deletePost, getOrCreateConversation, getUserConversations, getMessages, sendMessage, isConversationMember, searchUsers, createSession, getUserSessions, updateSessionStatus, deleteSession };
