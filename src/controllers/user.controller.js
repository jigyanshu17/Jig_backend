import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {
    User
} from "../models/user.models.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
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


const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user._id; // Assuming you have authentication middleware that adds user to req

   // Validate input
  if (!oldPasswordPassword || !newPassword ) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  // // Check if new passwords match
  // if (newPassword !== confirmNewPassword) {
  //   return res.status(400).json({
  //     success: false,
  //     message: "New passwords do not match",
  //   });
  // }
  // Find the user
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // Verify current password
  const isPasswordCorrect = await user.comparePassword(oldPassword);

  if (!isPasswordCorrect) {
    return res.status(401).json({
      success: false,
      message: "Current password is incorrect",
    });
  }

  const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({
      success: false,
      message:
        "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character",
    });
  }

  try {
    // Set and save new password
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });
    
    res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error.message,
    });
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

  

export {
  RegisterUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetail,
};
