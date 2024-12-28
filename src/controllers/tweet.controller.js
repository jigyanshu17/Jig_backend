import mongoose from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Create a new tweet
const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  // Create tweet and associate it with the logged-in user
  const tweet = await Tweet.create({
    content,
    owner: req.user._id,
  });

  // Handle creation failure
  if (!tweet) {
    throw new ApiError(500, "Failed to create tweet");
  }

  // Return success response with created tweet
  return res
    .status(201)
    .json(new ApiResponse(201, tweet, "Tweet created successfully"));
});

// Fetch all tweets of a specific user using aggregation
const getUserTweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Use aggregation pipeline to fetch tweets and populate owner details
  const tweets = await Tweet.aggregate([
    // Match tweets by the userId
    { $match: { owner: new mongoose.Types.ObjectId(userId) } },

    // Sort tweets by creation date (descending)
    { $sort: { createdAt: -1 } },

    // Lookup user details from the User collection
    {
      $lookup: {
        from: "users", // Collection name for users
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
      },
    },

    // Unwind the ownerDetails array to make it a single object
    { $unwind: "$ownerDetails" },

    // Project (select) only the necessary fields
    {
      $project: {
        content: 1,
        createdAt: 1,
        "ownerDetails.username": 1,
        "ownerDetails.fullName": 1,
        "ownerDetails.avatar": 1,
      },
    },
  ]);

  // Return success response with the aggregated tweets
  return res
    .status(200)
    .json(new ApiResponse(200, tweets, "User tweets fetched successfully"));
});

// Update an existing tweet
const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  const { content } = req.body;

  // Find the tweet to update
  const tweet = await Tweet.findById(tweetId);

  // Handle non-existent tweet
  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  // Check if the logged-in user owns the tweet
  if (tweet.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized to update this tweet");
  }

  // Update the tweet's content and fetch the updated document
  const updatedTweet = await Tweet.findByIdAndUpdate(
    tweetId,
    {
      $set: { content },
    },
    { new: true } // Return the updated document
  ).populate("owner", "username fullName avatar");

  // Handle update failure
  if (!updatedTweet) {
    throw new ApiError(500, "Failed to update tweet");
  }

  // Return success response with updated tweet
  return res
    .status(200)
    .json(new ApiResponse(200, updatedTweet, "Tweet updated successfully"));
});

// Delete a tweet
const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  // Find the tweet to delete
  const tweet = await Tweet.findById(tweetId);

  // Handle non-existent tweet
  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  // Check if the logged-in user owns the tweet
  if (tweet.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized to delete this tweet");
  }

  // Delete the tweet
  await Tweet.findByIdAndDelete(tweetId);

  // Return success response
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Tweet deleted successfully"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
