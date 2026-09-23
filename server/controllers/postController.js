import Post from "../models/Post.js";
import Comment from "../models/Comment.js";

export const createPost = async (req, res) => {
  const { text, image } = req.body;
  if (!text) return res.status(400).json({ message: "Post text is required" });

  const post = await Post.create({ author: req.user._id, text, image });
  const populated = await post.populate("author", "name headline profilePicture");
  res.status(201).json(populated);
};

export const getFeed = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  const posts = await Post.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("author", "name headline profilePicture");

  res.json(posts);
};

export const toggleLike = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });

  const uid = req.user._id.toString();
  const liked = post.likes.some((id) => id.toString() === uid);

  if (liked) {
    post.likes = post.likes.filter((id) => id.toString() !== uid);
  } else {
    post.likes.push(req.user._id);
  }

  await post.save();
  res.json({ likesCount: post.likes.length, liked: !liked });
};

export const addComment = async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ message: "Comment text is required" });

  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });

  const comment = await Comment.create({ post: post._id, author: req.user._id, text });
  const populated = await comment.populate("author", "name profilePicture");
  res.status(201).json(populated);
};

export const getComments = async (req, res) => {
  const comments = await Comment.find({ post: req.params.id })
    .sort({ createdAt: 1 })
    .populate("author", "name profilePicture");
  res.json(comments);
};

export const deletePost = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ message: "Post not found" });
  if (post.author.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Not allowed" });
  }
  await post.deleteOne();
  await Comment.deleteMany({ post: post._id });
  res.json({ message: "Post deleted" });
};