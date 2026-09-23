import express from "express";
import {
  createPost,
  getFeed,
  toggleLike,
  addComment,
  getComments,
  deletePost,
} from "../controllers/postController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, getFeed);
router.post("/", protect, createPost);
router.delete("/:id", protect, deletePost);
router.put("/:id/like", protect, toggleLike);
router.get("/:id/comments", protect, getComments);
router.post("/:id/comments", protect, addComment);

export default router;