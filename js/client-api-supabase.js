var API = (function() {
  var supabase = null;
  var SUPABASE_URL = 'https://vpyyyzmouhfzgxkwagta.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweXl5em1vdWhmemd4a3dhZ3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Nzg4OTQsImV4cCI6MjEwMjU1NDg5NH0._4qqxSJhgkxnUSM2AEhBInuBf7awzuFb6NxiWpTng8M';

  function initSupabase() {
    if (typeof window.supabase === 'undefined') {
      console.error('Supabase client not loaded. Add <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> to HTML');
      return null;
    }
    if (!supabase) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabase;
  }

  function hash(pw) {
    var h = 0;
    for (var i = 0; i < pw.length; i++) { h = ((h << 5) - h + pw.charCodeAt(i)) | 0; }
    return 'h' + Math.abs(h).toString(36);
  }

  function getSession() {
    var sb = initSupabase();
    if (!sb) return null;
    var session = sb.auth.getSession();
    return session.data.session;
  }

  function getUserId() {
    var session = getSession();
    return session?.user?.id || null;
  }

  return {
    signup: function(username, password, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      if (!username || !password) return cb({error: 'Username and password required'});
      if (username.length < 2 || username.length > 20) return cb({error: 'Username must be 2-20 characters'});
      if (password.length < 4) return cb({error: 'Password must be at least 4 characters'});

      sb.auth.signUp({
        email: username + '@skillswap.local',
        password: password,
        options: {
          data: { username: username, password_hash: hash(password) }
        }
      }).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        var user = res.data.user;
        return sb.from('users').insert({
          id: user.id,
          username: username,
          password_hash: hash(password)
        });
      }).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        sb.auth.signInWithPassword({email: username + '@skillswap.local', password: password}).then(function(r) {
          if (r.error) return cb({error: r.error.message});
          cb(null, {id: r.data.user.id, username: username});
        });
      });
    },

    login: function(username, password, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      sb.auth.signInWithPassword({email: username + '@skillswap.local', password: password}).then(function(res) {
        if (res.error) return cb({error: 'Invalid username or password'});
        cb(null, {id: res.data.user.id, username: username});
      });
    },

    logout: function(cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      sb.auth.signOut().then(function() { cb(null, {ok: true}); });
    },

    me: function(cb) {
      var sb = initSupabase();
      if (!sb) return cb(null, null);
      sb.auth.getSession().then(function(res) {
        if (res.data.session) {
          cb(null, {id: res.data.session.user.id, username: res.data.session.user.user_metadata.username || 'user'});
        } else {
          cb(null, null);
        }
      });
    },

    getUser: function(id, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      Promise.all([
        sb.from('users').select('*').eq('id', id).single(),
        sb.from('posts').select('*').eq('author_id', id).order('created_at', {ascending: false}),
        sb.from('likes').select('post_id'),
        sb.from('comments').select('post_id'),
        sb.auth.getSession()
      ]).then(function(results) {
        var user = results[0].data;
        var posts = results[1].data || [];
        var likes = results[2].data || [];
        var comments = results[3].data || [];
        var session = results[4].data.session;
        var userId = session?.user?.id;

        var likeMap = {};
        likes.forEach(function(l) { likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1; });
        var commentMap = {};
        comments.forEach(function(c) { commentMap[c.post_id] = (commentMap[c.post_id] || 0) + 1; });
        var userLikes = new Set(likes.filter(function(l) { return l.user_id === userId; }).map(function(l) { return l.post_id; }));

        posts = posts.map(function(p) {
          return Object.assign({}, p, {
            author_name: user.username,
            like_count: likeMap[p.id] || 0,
            comments_count: commentMap[p.id] || 0,
            liked: userLikes.has(p.id)
          });
        });

        cb(null, {
          id: user.id, username: user.username, bio: user.bio,
          teach_skills: user.teach_skills, learn_skills: user.learn_skills,
          created_at: user.created_at, posts: posts
        });
      }).catch(function(err) { cb({error: err.message}); });
    },

    updateUser: function(id, data, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var update = {};
      if (data.bio !== undefined) update.bio = data.bio;
      if (data.teach_skills !== undefined) update.teach_skills = data.teach_skills;
      if (data.learn_skills !== undefined) update.learn_skills = data.learn_skills;
      sb.from('users').update(update).eq('id', id).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        cb(null, res.data[0]);
      });
    },

    searchUsers: function(q, cb) {
      var sb = initSupabase();
      if (!sb) return cb(null, []);
      var userId = getUserId();
      if (!userId) return cb(null, []);
      sb.from('users').select('id, username').ilike('username', '%' + q + '%').neq('id', userId).limit(10).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        cb(null, res.data || []);
      });
    },

    getPosts: function(category, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var session = getSession();
      var userId = session?.user?.id;

      var query = sb.from('posts').select(`
        *,
        author:users!posts_author_id_fkey(username)
      `).order('created_at', {ascending: false});
      if (category && category !== 'all') query = query.eq('category', category);

      Promise.all([
        query,
        sb.from('likes').select('post_id, user_id'),
        sb.from('comments').select('post_id')
      ]).then(function(results) {
        var posts = results[0].data || [];
        var likes = results[1].data || [];
        var comments = results[2].data || [];

        var likeMap = {};
        var userLikes = new Set();
        likes.forEach(function(l) {
          likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1;
          if (l.user_id === userId) userLikes.add(l.post_id);
        });
        var commentMap = {};
        comments.forEach(function(c) { commentMap[c.post_id] = (commentMap[c.post_id] || 0) + 1; });

        posts = posts.map(function(p) {
          return Object.assign({}, p, {
            author_name: p.author?.username || '?',
            like_count: likeMap[p.id] || 0,
            comments_count: commentMap[p.id] || 0,
            liked: userLikes.has(p.id)
          });
        });
        cb(null, posts);
      }).catch(function(err) { cb({error: err.message}); });
    },

    createPost: function(type, body, skill_tag, category, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var userId = getUserId();
      if (!userId) return cb({error: 'Not logged in'});
      if (!type || !body || !skill_tag || !category) return cb({error: 'All fields required'});
      sb.from('posts').insert({author_id: userId, type: type, body: body, skill_tag: skill_tag, category: category}).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        cb(null, {id: res.data[0].id});
      });
    },

    deletePost: function(postId, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var userId = getUserId();
      if (!userId) return cb({error: 'Not logged in'});
      sb.from('posts').delete().eq('id', postId).eq('author_id', userId).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        cb(null, {ok: true});
      });
    },

    toggleLike: function(postId, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var userId = getUserId();
      if (!userId) return cb({error: 'Not logged in'});
      sb.from('likes').select('id').eq('user_id', userId).eq('post_id', postId).single().then(function(res) {
        if (res.data) {
          return sb.from('likes').delete().eq('id', res.data.id);
        } else {
          return sb.from('likes').insert({user_id: userId, post_id: postId});
        }
      }).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        cb(null, {liked: !res.data});
      });
    },

    getComments: function(postId, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      sb.from('comments').select(`
        *,
        author:users!comments_author_id_fkey(username)
      `).eq('post_id', postId).order('created_at', {ascending: true}).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        var comments = (res.data || []).map(function(c) {
          return Object.assign({}, c, {author_name: c.author?.username || '?'});
        });
        cb(null, comments);
      });
    },

    addComment: function(postId, body, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var userId = getUserId();
      if (!userId) return cb({error: 'Not logged in'});
      if (!body) return cb({error: 'Comment body required'});
      sb.from('comments').insert({author_id: userId, post_id: postId, body: body}).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        cb(null, {id: res.data[0].id});
      });
    },

    deleteComment: function(commentId, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var userId = getUserId();
      if (!userId) return cb({error: 'Not logged in'});
      sb.from('comments').delete().eq('id', commentId).eq('author_id', userId).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        cb(null, {ok: true});
      });
    },

    getConversations: function(cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var userId = getUserId();
      if (!userId) return cb(null, []);

      sb.from('conversation_members').select('conversation_id').eq('user_id', userId).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        var convIds = (res.data || []).map(function(m) { return m.conversation_id; });
        if (!convIds.length) return cb(null, []);

        sb.from('conversation_members').select('conversation_id, user_id').in('conversation_id', convIds).then(function(membersRes) {
          var members = membersRes.data || [];
          var otherUserIds = members.filter(function(m) { return m.user_id !== userId; }).map(function(m) { return m.user_id; });
          var convIdMap = {};
          members.filter(function(m) { return m.user_id !== userId; }).forEach(function(m) { convIdMap[m.user_id] = m.conversation_id; });

          Promise.all([
            sb.from('users').select('id, username').in('id', otherUserIds),
            sb.from('messages').select('*').in('conversation_id', convIds).order('created_at', {ascending: true})
          ]).then(function(results) {
            var users = results[0].data || [];
            var messages = results[1].data || [];
            var userMap = {}; users.forEach(function(u) { userMap[u.id] = u.username; });

            var msgsByConv = {};
            messages.forEach(function(m) {
              if (!msgsByConv[m.conversation_id]) msgsByConv[m.conversation_id] = [];
              msgsByConv[m.conversation_id].push(m);
            });

            var convs = Object.keys(convIdMap).map(function(otherId) {
              var convId = convIdMap[otherId];
              var convMsgs = msgsByConv[convId] || [];
              var last = convMsgs.length ? convMsgs[convMsgs.length - 1] : null;
              var unread = convMsgs.filter(function(m) { return m.sender_id !== userId; }).length;
              return {
                id: convId, other_id: otherId, other_name: userMap[otherId] || '?',
                last_message: last?.body || null, last_message_at: last?.created_at || null,
                unread: unread
              };
            }).sort(function(a, b) {
              if (!a.last_message_at) return 1;
              if (!b.last_message_at) return -1;
              return a.last_message_at > b.last_message_at ? -1 : 1;
            });
            cb(null, convs);
          });
        });
      }).catch(function(err) { cb({error: err.message}); });
    },

    createConversation: function(userId, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var myId = getUserId();
      if (!myId) return cb({error: 'Not logged in'});
      if (userId === myId) return cb({error: 'Cannot message yourself'});

      sb.from('conversation_members').select('conversation_id').eq('user_id', myId).then(function(res) {
        var myConvIds = new Set((res.data || []).map(function(m) { return m.conversation_id; }));
        return sb.from('conversation_members').select('conversation_id').eq('user_id', userId).then(function(res2) {
          var theirConvIds = new Set((res2.data || []).map(function(m) { return m.conversation_id; }));
          var existing = [...myConvIds].find(function(id) { return theirConvIds.has(id); });
          if (existing) return cb(null, {id: existing});

          sb.from('conversations').insert({}).then(function(convRes) {
            var convId = convRes.data[0].id;
            return sb.from('conversation_members').insert([
              {conversation_id: convId, user_id: myId},
              {conversation_id: convId, user_id: userId}
            ]).then(function() { cb(null, {id: convId}); });
          });
        });
      }).catch(function(err) { cb({error: err.message}); });
    },

    getMessages: function(convId, after, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var query = sb.from('messages').select(`
        *,
        sender:users!messages_sender_id_fkey(username)
      `).eq('conversation_id', convId).order('created_at', {ascending: true});
      if (after) query = query.gt('id', after);
      query.then(function(res) {
        if (res.error) return cb({error: res.error.message});
        var messages = (res.data || []).map(function(m) {
          return Object.assign({}, m, {sender_name: m.sender?.username || '?'});
        });
        cb(null, messages);
      });
    },

    sendMessage: function(convId, body, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var userId = getUserId();
      if (!userId) return cb({error: 'Not logged in'});
      if (!body || !body.trim()) return cb({error: 'Message required'});
      sb.from('messages').insert({conversation_id: convId, sender_id: userId, body: body.trim()}).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        cb(null, {id: res.data[0].id});
      });
    },

    getSessions: function(cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var userId = getUserId();
      if (!userId) return cb(null, []);
      sb.from('sessions').select(`
        *,
        organizer:users!sessions_organizer_id_fkey(username),
        participant:users!sessions_participant_id_fkey(username)
      `).or('organizer_id.eq.' + userId + ',participant_id.eq.' + userId).order('scheduled_at', {ascending: true}).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        var sessions = (res.data || []).map(function(s) {
          return Object.assign({}, s, {
            organizer_name: s.organizer?.username || '?',
            participant_name: s.participant?.username || '?'
          });
        });
        cb(null, sessions);
      });
    },

    createSession: function(participantId, skillTag, description, scheduledAt, duration, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var userId = getUserId();
      if (!userId) return cb({error: 'Not logged in'});
      if (!participantId || !skillTag || !scheduledAt) return cb({error: 'participant, skill, and date required'});
      sb.from('sessions').insert({
        organizer_id: userId, participant_id: participantId, skill_tag: skillTag,
        description: description || '', scheduled_at: scheduledAt, duration: duration || 60
      }).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        cb(null, {id: res.data[0].id});
      });
    },

    updateSession: function(sessionId, status, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var userId = getUserId();
      if (!userId) return cb({error: 'Not logged in'});
      if (['accepted', 'declined', 'cancelled'].indexOf(status) === -1) return cb({error: 'Invalid status'});
      sb.from('sessions').update({status: status}).eq('id', sessionId).or('organizer_id.eq.' + userId + ',participant_id.eq.' + userId).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        if (!res.data.length) return cb({error: 'Not authorized'});
        cb(null, res.data[0]);
      });
    },

    deleteSession: function(sessionId, cb) {
      var sb = initSupabase();
      if (!sb) return cb({error: 'Supabase not initialized'});
      var userId = getUserId();
      if (!userId) return cb({error: 'Not logged in'});
      sb.from('sessions').delete().eq('id', sessionId).or('organizer_id.eq.' + userId + ',participant_id.eq.' + userId).then(function(res) {
        if (res.error) return cb({error: res.error.message});
        if (!res.data.length) return cb({error: 'Not found'});
        cb(null, {ok: true});
      });
    }
  };
})();
