import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
    User
} from "../models/user.models.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";


const generateAccessandRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const acessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { acessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Failed to generate token");
  }
}

const RegisterUser = asyncHandler(async (req, res) => {
  // Step 1: Validate request body
  const { username, email, fullName, password } = req.body;

  // Check if any required field is empty
  if (
    [username, email, fullName, password].some(
      (field) => field?.trim() === "" || field === undefined
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // Step 2: Check if user already exists
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar and Cover Image are required");
  }

  const avatar = await uploadToCloudinary(avatarLocalPath);
  const coverImage = await uploadToCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(500, "Failed to upload image");
  }

  // Step 3: user created and entry in database
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // Step 4: Verify user creation and remove sensitive information
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
    }


    //return response
    return res.status(201).json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => { 

  const { username, email, password } = req.body;
  
  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }

  
  
  const user = await User.findOne({ $or: [{ username }, { email }] });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid password");
  }

  const { acessToken, refreshToken } = await generateAccessandRefreshToken(user._id);
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: true,
  };
  
  return res
    .status(200)
    .cookie("accessToken", acessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200,
      { user: loggedInUser, acessToken, refreshToken },
      "User logged in successfully"
    ));

 })

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id,
    {
      $set: { refreshToken: "" },
    },
    { new: true }
  
    
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));

});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // Step 1: Extract Refresh Token
  // Retrieve refresh token from cookies or request body
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  // Step 2: Validate Refresh Token Presence
  // Check if refresh token exists
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request");
  }

  try {
    // Step 3: Verify Refresh Token
    // Decode and verify the refresh token using the secret key
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // Step 4: Find User Associated with Token
    // Retrieve user from database using decoded token's ID
    const user = await User.findById(decodedToken?._id);

    // Step 5: Validate User Existence
    // Ensure user exists in the database
    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    // Step 6: Validate Refresh Token Integrity
    // Check if the incoming refresh token matches the stored refresh token
    if (user?.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Refresh Token has been expired or used");
    }

    // Step 7: Set Cookie Options
    // Configure cookie settings for security
    const options = {
      httpOnly: true,
      secure: true,
    };

    // Step 8: Generate New Tokens
    // Create new access and refresh tokens
    const { accessToken, newRefreshToken } =
      await generateAccessandRefreshToken(user._id);

    // Step 9: Send Response
    // Return new tokens via cookies and JSON response
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Token refreshed successfully"
        )
      );
  } catch (error) {
    // Step 10: Error Handling
    // Catch and handle any errors during token refresh process
    throw new ApiError(401, error?.message || "Invalid Refresh Token");
  }
});


const changeCurrentPassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user?._id; // Assuming you have authentication middleware that adds user to req

  // Validate input
  if (!oldPassword || !newPassword) {
    return next(new ApiError(400, "Please provide both old and new passwords"));
  }

  // Find the user
  const user = await User.findById(userId);

  if (!user) {
    return next(new ApiError(404, "User not found"));
  }

  // Verify current password
  const isPasswordCorrect = await user.comparePassword(oldPassword);

  if (!isPasswordCorrect) {
    return next(new ApiError(401, "Current password is incorrect"));
  }

  // Validate new password strength
  const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return next(
      new ApiError(
        400,
        "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character"
      )
    );
  }

  try {
    // Set and save new password
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    res
      .status(200)
      .json(new ApiResponse(200, {}, "Password changed successfully"));
  } catch (error) {
    next(new ApiError(500, "Failed to change password"));
  }
});



  

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(
      200,
      req.user, // req.user populated by middleware
      "User fetched successfully"
    )
  );
});

const updateAccountDetail = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  // Check for required fields
  if (!fullName && !email) {
    throw new ApiError(400, "Please provide fullName or email to update");
  }

  // Validate email if provided
  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApiError(400, "Invalid email format");
  }

  const userId = req.user?._id; // Get user ID from req.user set by verifyJWT middleware

  // Update user details
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { ...(fullName && { fullName }), ...(email && { email }) }, // Update fields only if they are provided
    { new: true, runValidators: true } // Return the updated document and validate changes
  ).select("-password ");

  if (!updatedUser) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(new ApiResponse(200, updatedUser, "User details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  // Delete the old avatar from Cloudinary
  // const oldAvatar = req.user?.avatar; // Assuming `req.user` has the logged-in user's data
  // if (oldAvatar) {
  //   try {
  //     await deleteFromCloudinary(oldAvatar); // Delete old avatar from Cloudinary
  //   } catch (error) {
  //     console.error("Error deleting old avatar:", error.message);
  //   }
  // }

  // Upload the new avatar to Cloudinary
  const avatar = await uploadToCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading avatar");
  }

  // Update the user's avatar URL in the database
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true } // Return the updated document
  ).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Respond with the updated user details
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  // Delete the old cover image from Cloudinary if it exists
  // const oldCoverImage = req.user?.coverImage; // Assuming `req.user` has the logged-in user's data
  // if (oldCoverImage) {
  //   try {
  //     await deleteFromCloudinary(oldCoverImage); // Delete old cover image from Cloudinary
  //   } catch (error) {
  //     console.error("Error deleting old cover image:", error.message);
  //   }
  // }

  // Upload the new cover image to Cloudinary
  const coverImage = await uploadToCloudinary(coverImageLocalPath);

  if ( !coverImage.url) {
    throw new ApiError(400, "Error while uploading cover image");
  }

  // Update user's cover image in the database
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true } // Return the updated document
  ).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => { 
  const { username } = req.params
  
  if(!username?.trim()) {
    throw new ApiError(400, "Username is missing")
  }

  const channel = User.aggregate([
    {
      $match: { username: username?.toLowerCase() },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTO",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers"
        },
        channelsubscribedToCount: {
          $size: "$subscribedTO"
        },
        isSubscribed: {
          $cond: {
            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
            then: true,
            else: false
          }
        },
      },
    },
    {
      $project: {
      fullName: 1,
        username: 1,
        subscriberCount: 1,
      channelsubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
        
      },
    }
  ]);

  if(!channel?.length) {
    throw new ApiError(404, "Channel not found")
  }

  return res
    .status(200)
    .json(new ApiResponse(
      200,
      channel[0],
      "Channel profile fetched successfully"));
 

});
  
const getHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(
      200,
      user[0].watchHistory,
      "Watch history fetched successfully"
  ))

})

export {
  RegisterUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetail,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getHistory,
};
