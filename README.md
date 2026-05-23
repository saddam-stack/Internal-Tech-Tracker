# Internal Tech Issue & Feature Tracker

This is my 2nd assignment project. I built a REST API where software teams can report issues and suggest new features.

// Live API
coming soon after deployment

# Tech Used
- Node.js with TypeScript
- Express.js
- PostgreSQL on NeonDB
- bcrypt for password hashing
- JWT for authentication

# How to Run Locally

clone the project first then run these commands

npm install

create a .env file and add these

PORT=5000
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

then run

npm run dev

server will start on port 5000

# API List

POST /api/auth/signup - create new account
POST /api/auth/login - login and get token
POST /api/issues - create new issue
GET /api/issues - get all issues
GET /api/issues/:id - get single issue
PATCH /api/issues/:id - update issue
DELETE /api/issues/:id - delete issue (maintainer only)

# Roles

contributor can create and view issues maintainer can do everything including delete and status change

# Database Tables

users table has id, name, email, password, role, created_at, updated_at

issues table has id, title, description, type, status, reporter_id, 
created_at, updated_at