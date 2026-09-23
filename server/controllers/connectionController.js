import Connection from "../models/Connection.js";
import User from "../models/User.js";

export const sendRequest = async (req, res) => {
  const { recipientId } = req.body;
  if (recipientId === req.user._id.toString()) {
    return res.status(400).json({ message: "Cannot connect with yourself" });
  }

  const existing = await Connection.findOne({
    $or: [
      { requester: req.user._id, recipient: recipientId },
      { requester: recipientId, recipient: req.user._id },
    ],
  });
  if (existing) return res.status(400).json({ message: "Connection already exists" });

  const connection = await Connection.create({
    requester: req.user._id,
    recipient: recipientId,
  });
  res.status(201).json(connection);
};

export const respondRequest = async (req, res) => {
  const { status } = req.body; // "accepted" | "rejected"
  const connection = await Connection.findById(req.params.id);
  if (!connection) return res.status(404).json({ message: "Request not found" });
  if (connection.recipient.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Not allowed" });
  }

  connection.status = status;
  await connection.save();

  if (status === "accepted") {
    await User.findByIdAndUpdate(connection.requester, { $addToSet: { connections: connection.recipient } });
    await User.findByIdAndUpdate(connection.recipient, { $addToSet: { connections: connection.requester } });
  }

  res.json(connection);
};

export const getPendingRequests = async (req, res) => {
  const requests = await Connection.find({ recipient: req.user._id, status: "pending" }).populate(
    "requester",
    "name headline profilePicture"
  );
  res.json(requests);
};

export const getMyConnections = async (req, res) => {
  const user = await User.findById(req.user._id).populate("connections", "name headline profilePicture");
  res.json(user.connections);
};