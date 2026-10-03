import express from "express";
import { register, login, logout, getMe } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get(
  "/me",
  (req, res, next) => {
    const hasToken = req.cookies?.token || req.headers.authorization?.startsWith("Bearer ");
    if (!hasToken) return res.json({ user: null });
    return protect(req, res, next);
  },
  getMe
);

export default router;