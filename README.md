# Skill Swap

Learn and teach skills from people around the world.

A full-stack web app where users can share skills, with a Node.js server and SQLite database.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open http://localhost:3000

That's it. The database is created automatically on first run.

## Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (no frameworks)
- **Backend:** Node.js + Express
- **Database:** SQLite (via better-sqlite3)
- **Auth:** Session-based with bcrypt password hashing

## Project Structure

```
skillshare/
├── server.js              # Express server + API routes
├── server/
│   └── db.js              # SQLite database setup + queries
├── index.html             # Landing page
├── css/style.css          # All styles + animations
├── js/
│   ├── constants.js       # Skill categories
│   ├── utils.js           # Helper functions + scroll animations
│   └── layout.js          # Shared sidebar/topbar + auth check
└── pages/
    ├── auth.html          # Login / Sign up
    ├── feed.html          # Skill feed (create, like, browse)
    ├── profile.html       # User profiles + edit
    ├── messages.html      # Chat UI
    ├── schedule.html      # Calendar + sessions
    └── call.html          # Video call lobby
```

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/signup | Create account |
| POST | /api/auth/login | Sign in |
| POST | /api/auth/logout | Sign out |
| GET | /api/auth/me | Get current user |
| GET | /api/users/:id | Get user profile + posts |
| PUT | /api/users/:id | Update profile |
| GET | /api/posts | List posts (optional ?category=) |
| POST | /api/posts | Create post |
| POST | /api/posts/:id/like | Toggle like |
| POST | /api/posts/:id/comments | Add comment |
| GET | /api/posts/:id/comments | Get comments |
| DELETE | /api/posts/:id | Delete own post |
