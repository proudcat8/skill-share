-- Run this in Supabase SQL Editor (Project → SQL Editor → New Query)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  bio TEXT DEFAULT '',
  teach_skills TEXT[] DEFAULT '{}',
  learn_skills TEXT[] DEFAULT '{}',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('teach', 'learn')),
  body TEXT NOT NULL,
  skill_tag TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Likes table
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Comments table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversation members
CREATE TABLE conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(conversation_id, user_id)
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES users(id) ON DELETE CASCADE,
  skill_tag TEXT NOT NULL,
  description TEXT DEFAULT '',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration INTEGER DEFAULT 60,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users: users can read all, update own
CREATE POLICY "Users can read all" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own" ON users FOR UPDATE USING (auth.uid() = id);

-- Posts: public read, auth write own
CREATE POLICY "Posts public read" ON posts FOR SELECT USING (true);
CREATE POLICY "Posts insert own" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Posts delete own" ON posts FOR DELETE USING (auth.uid() = author_id);

-- Likes: public read, auth write own
CREATE POLICY "Likes public read" ON likes FOR SELECT USING (true);
CREATE POLICY "Likes insert own" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Likes delete own" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Comments: public read, auth write own
CREATE POLICY "Comments public read" ON comments FOR SELECT USING (true);
CREATE POLICY "Comments insert own" ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Comments delete own" ON comments FOR DELETE USING (auth.uid() = author_id);

-- Conversations: members only
CREATE POLICY "Conv members read" ON conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = conversations.id AND user_id = auth.uid())
);
CREATE POLICY "Conv insert" ON conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Conv members insert" ON conversation_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Messages: conversation members only
CREATE POLICY "Messages read members" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Messages insert members" ON messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
);

-- Sessions: organizer or participant
CREATE POLICY "Sessions read own" ON sessions FOR SELECT USING (
  auth.uid() = organizer_id OR auth.uid() = participant_id
);
CREATE POLICY "Sessions insert organizer" ON sessions FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "Sessions update own" ON sessions FOR UPDATE USING (
  auth.uid() = organizer_id OR auth.uid() = participant_id
);
CREATE POLICY "Sessions delete own" ON sessions FOR DELETE USING (
  auth.uid() = organizer_id OR auth.uid() = participant_id
);

-- Indexes for performance
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_category ON posts(category);
CREATE INDEX idx_likes_post ON likes(post_id);
CREATE INDEX idx_likes_user ON likes(user_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_messages_conv ON messages(conversation_id);
CREATE INDEX idx_sessions_organizer ON sessions(organizer_id);
CREATE INDEX idx_sessions_participant ON sessions(participant_id);