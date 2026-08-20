var API = (function() {
  function get(k) { try { return JSON.parse(localStorage.getItem('ss_' + k)) || []; } catch(e) { return []; } }
  function set(k, v) { localStorage.setItem('ss_' + k, JSON.stringify(v)); }
  function nextId(k) { var items = get(k); return items.length ? Math.max.apply(null, items.map(function(i){return i.id})) + 1 : 1; }
  function now() { return new Date().toISOString(); }

  function hash(pw) {
    var h = 0;
    for (var i = 0; i < pw.length; i++) { h = ((h << 5) - h + pw.charCodeAt(i)) | 0; }
    return 'h' + Math.abs(h).toString(36);
  }

  var _session = null;

  function getSession() {
    if (_session) return _session;
    try { _session = JSON.parse(localStorage.getItem('ss_session')); } catch(e) {}
    return _session;
  }

  return {
    signup: function(username, password, cb) {
      var users = get('users');
      if (!username || !password) return cb({error:'Username and password required'});
      if (username.length < 2 || username.length > 20) return cb({error:'Username must be 2-20 characters'});
      if (password.length < 4) return cb({error:'Password must be at least 4 characters'});
      if (users.some(function(u){return u.username===username})) return cb({error:'Username already taken'});
      var id = nextId('users');
      users.push({id:id, username:username, password_hash:hash(password), bio:'', teach_skills:[], learn_skills:[], avatar_url:'', created_at:now()});
      set('users', users);
      _session = {id:id, username:username};
      localStorage.setItem('ss_session', JSON.stringify(_session));
      cb(null, _session);
    },

    login: function(username, password, cb) {
      var users = get('users');
      var user = users.filter(function(u){return u.username===username})[0];
      if (!user || user.password_hash !== hash(password)) return cb({error:'Invalid username or password'});
      _session = {id:user.id, username:user.username};
      localStorage.setItem('ss_session', JSON.stringify(_session));
      cb(null, _session);
    },

    logout: function(cb) {
      _session = null;
      localStorage.removeItem('ss_session');
      cb(null, {ok:true});
    },

    me: function(cb) {
      cb(null, getSession());
    },

    getUser: function(id, cb) {
      var users = get('users');
      var u = users.filter(function(u){return u.id==id})[0];
      if (!u) return cb({error:'Not found'});
      var posts = get('posts').filter(function(p){return p.author_id==id}).map(function(p){
        var author = users.filter(function(u){return u.id==p.author_id})[0];
        var likes = get('likes');
        var comments = get('comments');
        return Object.assign({}, p, {
          author_name: author ? author.username : '?',
          like_count: likes.filter(function(l){return l.post_id==p.id}).length,
          comments_count: comments.filter(function(c){return c.post_id==p.id}).length,
          liked: getSession() ? likes.some(function(l){return l.user_id==getSession().id && l.post_id==p.id}) : false
        });
      }).sort(function(a,b){return b.id - a.id});
      cb(null, {id:u.id, username:u.username, bio:u.bio, teach_skills:u.teach_skills, learn_skills:u.learn_skills, created_at:u.created_at, posts:posts});
    },

    updateUser: function(id, data, cb) {
      var users = get('users');
      var idx = -1;
      users.forEach(function(u,i){if(u.id==id) idx=i;});
      if (idx===-1) return cb({error:'Not found'});
      if (data.bio !== undefined) users[idx].bio = data.bio;
      if (data.teach_skills !== undefined) users[idx].teach_skills = data.teach_skills;
      if (data.learn_skills !== undefined) users[idx].learn_skills = data.learn_skills;
      set('users', users);
      cb(null, users[idx]);
    },

    searchUsers: function(q, cb) {
      var s = getSession();
      if (!s) return cb(null, []);
      var users = get('users');
      var results = users.filter(function(u){return u.username.toLowerCase().indexOf(q.toLowerCase())!==-1 && u.id!==s.id}).slice(0,10).map(function(u){return{id:u.id,username:u.username}});
      cb(null, results);
    },

    getPosts: function(category, cb) {
      var s = getSession();
      var posts = get('posts');
      var users = get('users');
      var likes = get('likes');
      var comments = get('comments');
      if (category && category !== 'all') posts = posts.filter(function(p){return p.category===category});
      posts = posts.map(function(p){
        var author = users.filter(function(u){return u.id==p.author_id})[0];
        return Object.assign({}, p, {
          author_name: author ? author.username : '?',
          like_count: likes.filter(function(l){return l.post_id==p.id}).length,
          comments_count: comments.filter(function(c){return c.post_id==p.id}).length,
          liked: s ? likes.some(function(l){return l.user_id==s.id && l.post_id==p.id}) : false
        });
      }).sort(function(a,b){return b.id - a.id});
      cb(null, posts);
    },

    createPost: function(type, body, skill_tag, category, cb) {
      var s = getSession();
      if (!s) return cb({error:'Not logged in'});
      if (!type || !body || !skill_tag || !category) return cb({error:'All fields required'});
      var posts = get('posts');
      var id = nextId('posts');
      posts.push({id:id, author_id:s.id, type:type, body:body, skill_tag:skill_tag, category:category, created_at:now()});
      set('posts', posts);
      cb(null, {id:id});
    },

    deletePost: function(postId, cb) {
      var s = getSession();
      if (!s) return cb({error:'Not logged in'});
      var posts = get('posts').filter(function(p){return !(p.id==postId && p.author_id==s.id)});
      set('posts', posts);
      cb(null, {ok:true});
    },

    toggleLike: function(postId, cb) {
      var s = getSession();
      if (!s) return cb({error:'Not logged in'});
      var likes = get('likes');
      var idx = -1;
      likes.forEach(function(l,i){if(l.user_id==s.id && l.post_id==postId) idx=i;});
      if (idx!==-1) { likes.splice(idx,1); set('likes',likes); cb(null,{liked:false}); }
      else { likes.push({user_id:s.id, post_id:postId, created_at:now()}); set('likes',likes); cb(null,{liked:true}); }
    },

    getComments: function(postId, cb) {
      var comments = get('comments');
      var users = get('users');
      var result = comments.filter(function(c){return c.post_id==postId}).map(function(c){
        var author = users.filter(function(u){return u.id==c.author_id})[0];
        return Object.assign({}, c, {author_name: author ? author.username : '?'});
      }).sort(function(a,b){return a.id - b.id});
      cb(null, result);
    },

    addComment: function(postId, body, cb) {
      var s = getSession();
      if (!s) return cb({error:'Not logged in'});
      if (!body) return cb({error:'Comment body required'});
      var comments = get('comments');
      var id = nextId('comments');
      comments.push({id:id, author_id:s.id, post_id:postId, body:body, created_at:now()});
      set('comments', comments);
      cb(null, {id:id});
    },

    deleteComment: function(commentId, cb) {
      var s = getSession();
      if (!s) return cb({error:'Not logged in'});
      var comments = get('comments').filter(function(c){return !(c.id==commentId && c.author_id==s.id)});
      set('comments', comments);
      cb(null, {ok:true});
    },

    getConversations: function(cb) {
      var s = getSession();
      if (!s) return cb(null, []);
      var convs = get('conversations');
      var members = get('conv_members');
      var messages = get('messages');
      var users = get('users');
      var mine = convs.filter(function(c){
        return members.some(function(m){return m.conv_id==c.id && m.user_id==s.id});
      }).map(function(c){
        var otherMember = members.filter(function(m){return m.conv_id==c.id && m.user_id!=s.id})[0];
        var other = otherMember ? users.filter(function(u){return u.id==otherMember.user_id})[0] : null;
        var convMsgs = messages.filter(function(m){return m.conv_id==c.id}).sort(function(a,b){return a.id-b.id});
        var last = convMsgs.length ? convMsgs[convMsgs.length-1] : null;
        return {
          id:c.id, other_id:other?other.id:0, other_name:other?other.username:'?',
          last_message:last?last.body:null, last_message_at:last?last.created_at:null,
          unread: messages.filter(function(m){return m.conv_id==c.id && m.sender_id!=s.id}).length
        };
      }).sort(function(a,b){
        if (!a.last_message_at) return 1;
        if (!b.last_message_at) return -1;
        return a.last_message_at > b.last_message_at ? -1 : 1;
      });
      cb(null, mine);
    },

    createConversation: function(userId, cb) {
      var s = getSession();
      if (!s) return cb({error:'Not logged in'});
      if (userId == s.id) return cb({error:'Cannot message yourself'});
      var convs = get('conversations');
      var members = get('conv_members');
      var existing = convs.filter(function(c){
        var m1 = members.some(function(m){return m.conv_id==c.id && m.user_id==s.id});
        var m2 = members.some(function(m){return m.conv_id==c.id && m.user_id==userId});
        return m1 && m2;
      })[0];
      if (existing) return cb(null, {id:existing.id});
      var id = nextId('conversations');
      convs.push({id:id, created_at:now()});
      members.push({conv_id:id, user_id:s.id});
      members.push({conv_id:id, user_id:userId});
      set('conversations', convs);
      set('conv_members', members);
      cb(null, {id:id});
    },

    getMessages: function(convId, after, cb) {
      var messages = get('messages').filter(function(m){return m.conv_id==convId});
      if (after) messages = messages.filter(function(m){return m.id > after});
      var users = get('users');
      messages = messages.map(function(m){
        var sender = users.filter(function(u){return u.id==m.sender_id})[0];
        return Object.assign({}, m, {sender_name: sender ? sender.username : '?'});
      }).sort(function(a,b){return a.id - b.id});
      cb(null, messages);
    },

    sendMessage: function(convId, body, cb) {
      var s = getSession();
      if (!s) return cb({error:'Not logged in'});
      if (!body || !body.trim()) return cb({error:'Message required'});
      var messages = get('messages');
      var id = nextId('messages');
      messages.push({id:id, conv_id:convId, sender_id:s.id, body:body.trim(), created_at:now()});
      set('messages', messages);
      cb(null, {id:id});
    },

    getSessions: function(cb) {
      var s = getSession();
      if (!s) return cb(null, []);
      var sessions = get('sessions').filter(function(ses){return ses.organizer_id==s.id || ses.participant_id==s.id});
      var users = get('users');
      sessions = sessions.map(function(ses){
        var org = users.filter(function(u){return u.id==ses.organizer_id})[0];
        var part = users.filter(function(u){return u.id==ses.participant_id})[0];
        return Object.assign({}, ses, {
          organizer_name: org ? org.username : '?',
          participant_name: part ? part.username : '?'
        });
      }).sort(function(a,b){return a.scheduled_at > b.scheduled_at ? 1 : -1});
      cb(null, sessions);
    },

    createSession: function(participantId, skillTag, description, scheduledAt, duration, cb) {
      var s = getSession();
      if (!s) return cb({error:'Not logged in'});
      if (!participantId || !skillTag || !scheduledAt) return cb({error:'participant, skill, and date required'});
      var sessions = get('sessions');
      var id = nextId('sessions');
      sessions.push({id:id, organizer_id:s.id, participant_id:participantId, skill_tag:skillTag, description:description||'', scheduled_at:scheduledAt, duration:duration||60, status:'pending', created_at:now()});
      set('sessions', sessions);
      cb(null, {id:id});
    },

    updateSession: function(sessionId, status, cb) {
      var s = getSession();
      if (!s) return cb({error:'Not logged in'});
      if (['accepted','declined','cancelled'].indexOf(status)===-1) return cb({error:'Invalid status'});
      var sessions = get('sessions');
      var idx = -1;
      sessions.forEach(function(ses,i){if(ses.id==sessionId) idx=i;});
      if (idx===-1) return cb({error:'Session not found'});
      if (sessions[idx].organizer_id!=s.id && sessions[idx].participant_id!=s.id) return cb({error:'Not authorized'});
      sessions[idx].status = status;
      set('sessions', sessions);
      var users = get('users');
      var ses = sessions[idx];
      var org = users.filter(function(u){return u.id==ses.organizer_id})[0];
      var part = users.filter(function(u){return u.id==ses.participant_id})[0];
      cb(null, Object.assign({}, ses, {organizer_name:org?org.username:'?', participant_name:part?part.username:'?'}));
    },

    deleteSession: function(sessionId, cb) {
      var s = getSession();
      if (!s) return cb({error:'Not logged in'});
      var sessions = get('sessions');
      var ses = sessions.filter(function(ses){return ses.id==sessionId})[0];
      if (!ses || (ses.organizer_id!=s.id && ses.participant_id!=s.id)) return cb({error:'Not found'});
      sessions = sessions.filter(function(ses){return ses.id!=sessionId});
      set('sessions', sessions);
      cb(null, {ok:true});
    }
  };
})();
