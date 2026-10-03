# Running this project on Replit

The app runs from the existing Express backend. Its configured **Start application** workflow runs `cd server && npm start` on port 5000 and serves the frontend from `server/public`.

## Database setup

Sign-in, registration, posts, profiles, and connections require a reachable MongoDB database. Set `MONGO_URI` and `JWT_SECRET` in Replit Secrets. If using MongoDB Atlas, allow connections from this environment in its network-access settings.

The server and frontend can still start without a database, but database-backed requests will not work. `GET /api/health` reports the connection state and returns HTTP 503 while MongoDB is disconnected.

## Frontend

The responsive Common Ground frontend uses the existing same-origin `/api` routes and HTTP-only session cookie. Its source files are in `server/public`.

**Security note:** `server/.env` is tracked by Git. Do not add real credentials to a committed environment file. Move the MongoDB URI and JWT signing secret into Replit Secrets, rotate them if they have been shared or pushed to a remote repository, and only then remove the committed file from version control.