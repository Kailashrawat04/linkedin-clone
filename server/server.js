import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import connectionRoutes from "./routes/connectionRoutes.js";
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  const database = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const status = database === "connected" ? "ok" : "degraded";
  res.status(database === "connected" ? 200 : 503).json({ status, database });
});
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/users", userRoutes);

app.use(express.static(new URL("./public/", import.meta.url).pathname));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const databaseUnavailable = mongoose.connection.readyState !== 1;
  console.error(`Request failed (${err.name || "Error"}).`);
  res.status(databaseUnavailable ? 503 : 500).json({
    message: databaseUnavailable
      ? "The database is unavailable. Check the MongoDB connection and try again."
      : "The request could not be completed. Please try again.",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  void connectDB();
});