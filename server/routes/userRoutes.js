import express from "express";
import { getUserById, updateProfile, searchUsers } from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/search", protect, searchUsers);
router.get("/:id", protect, getUserById);
router.put("/profile", protect, updateProfile);

export default router;