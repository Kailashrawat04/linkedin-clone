import express from "express";
import {
  sendRequest,
  respondRequest,
  getPendingRequests,
  getMyConnections,
} from "../controllers/connectionController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/request", protect, sendRequest);
router.put("/request/:id", protect, respondRequest);
router.get("/pending", protect, getPendingRequests);
router.get("/", protect, getMyConnections);

export default router;