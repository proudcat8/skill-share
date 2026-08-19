const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDB, createUser, verifyUser, getUser, updateUser, createPost, getPosts, getPostsByUser, toggleLike, getLikedPosts, addComment, getComments, deleteComment, deletePost, getOrCreateConversation, getUserConversations, getMessages, sendMessage, isConversationMember, searchUsers, createSession, getUserSessions, updateSessionStatus, deleteSession } = require('./server/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'skillshare-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function authRequired(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  next();
}

app.post('/api/auth/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: 'Username must be 2-20 characters' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  try {
    const id = createUser(username, password);
    req.session.userId = id;
    res.json({ id, username });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = verifyUser(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  req.session.userId = user.id;
  res.json({ id: user.id, username: user.username });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) return res.json(null);
  const user = getUser(req.session.userId);
  if (!user) return res.json(null);
  res.json(user);
});

app.get('/api/users/:id', (req, res) => {
  const user = getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.posts = getPostsByUser(user.id);
  if (req.session.userId) {
    const liked = getLikedPosts(req.session.userId);
    user.posts.forEach(p => p.liked = liked.includes(p.id));
  }
  res.json(user);
});

app.put('/api/users/:id', authRequired, (req, res) => {
  if (parseInt(req.params.id) !== req.session.userId) return res.status(403).json({ error: 'Not authorized' });
  updateUser(req.params.id, req.body);
  res.json(getUser(req.params.id));
});

app.get('/api/posts', (req, res) => {
  const posts = getPosts(req.query.category);
  if (req.session.userId) {
    const liked = getLikedPosts(req.session.userId);
    posts.forEach(p => p.liked = liked.includes(p.id));
  }
  res.json(posts);
});

app.post('/api/posts', authRequired, (req, res) => {
  const { type, body, skill_tag, category } = req.body;
  if (!type || !body || !skill_tag || !category) return res.status(400).json({ error: 'All fields required' });
  const id = createPost(req.session.userId, type, body, skill_tag, category);
  res.json({ id });
});

app.post('/api/posts/:id/like', authRequired, (req, res) => {
  const liked = toggleLike(req.session.userId, parseInt(req.params.id));
  res.json({ liked });
});

app.post('/api/posts/:id/comments', authRequired, (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'Comment body required' });
  const id = addComment(req.session.userId, parseInt(req.params.id), body);
  res.json({ id });
});

app.get('/api/posts/:id/comments', (req, res) => {
  res.json(getComments(parseInt(req.params.id)));
});

app.delete('/api/posts/:id', authRequired, (req, res) => {
  deletePost(req.session.userId, parseInt(req.params.id));
  res.json({ ok: true });
});

app.get('/api/conversations', authRequired, (req, res) => {
  res.json(getUserConversations(req.session.userId));
});

app.post('/api/conversations', authRequired, (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  if (user_id === req.session.userId) return res.status(400).json({ error: 'Cannot message yourself' });
  const convId = getOrCreateConversation(req.session.userId, user_id);
  res.json({ id: convId });
});

app.get('/api/conversations/:id/messages', authRequired, (req, res) => {
  const convId = parseInt(req.params.id);
  if (!isConversationMember(convId, req.session.userId)) return res.status(403).json({ error: 'Not a member' });
  const after = req.query.after;
  let msgs = getMessages(convId, req.session.userId);
  if (after) msgs = msgs.filter(m => m.id > parseInt(after));
  res.json(msgs);
});

app.post('/api/conversations/:id/messages', authRequired, (req, res) => {
  const convId = parseInt(req.params.id);
  if (!isConversationMember(convId, req.session.userId)) return res.status(403).json({ error: 'Not a member' });
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Message required' });
  const id = sendMessage(convId, req.session.userId, body.trim());
  res.json({ id });
});

app.get('/api/users', authRequired, (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  res.json(searchUsers(q, req.session.userId));
});

app.delete('/api/comments/:id', authRequired, (req, res) => {
  deleteComment(req.session.userId, parseInt(req.params.id));
  res.json({ ok: true });
});

app.post('/api/sessions', authRequired, (req, res) => {
  const { participant_id, skill_tag, description, scheduled_at, duration } = req.body;
  if (!participant_id || !skill_tag || !scheduled_at) return res.status(400).json({ error: 'participant, skill, and date required' });
  const id = createSession(req.session.userId, participant_id, skill_tag, description || '', scheduled_at, duration || 60);
  res.json({ id });
});

app.get('/api/sessions', authRequired, (req, res) => {
  res.json(getUserSessions(req.session.userId));
});

app.put('/api/sessions/:id', authRequired, (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'declined', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const session = updateSessionStatus(parseInt(req.params.id), req.session.userId, status);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.delete('/api/sessions/:id', authRequired, (req, res) => {
  if (!deleteSession(parseInt(req.params.id), req.session.userId)) return res.status(404).json({ error: 'Session not found' });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname)));

app.get('/{*path}', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  Skill Swap running at http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
