import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.warn("MongoDB is not configured. Set MONGO_URI to enable database-backed features.");
      return false;
    }

    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log("MongoDB connected.");
    return true;
  } catch (err) {
    console.error(`MongoDB connection failed (${err.name}). Check MONGO_URI and database network access.`);
    return false;
  }
};

export default connectDB;