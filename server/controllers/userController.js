import User from "../models/User.js";

export const getUserById = async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

export const updateProfile = async (req, res) => {
  const allowed = ["name", "headline", "bio", "location", "profilePicture", "coverPicture", "experience", "education", "skills"];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  }).select("-password");

  res.json(user);
};

export const searchUsers = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  const users = await User.find({
    $or: [
      { name: { $regex: q, $options: "i" } },
      { headline: { $regex: q, $options: "i" } },
    ],
  })
    .select("name headline profilePicture")
    .limit(20);

  res.json(users);
};