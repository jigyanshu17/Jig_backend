import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    const token =
      req.cookies.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    console.log("Received Token:", token); // Log the received token

    if (!token) {
      throw new ApiError(401, "Unauthorized request: No token provided");
    }

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      console.log("Decoded Token:", decodedToken); // Log decoded token details
    } catch (verifyError) {
      console.error("Token Verification Error:", verifyError);

      if (verifyError.name === "TokenExpiredError") {
        throw new ApiError(401, "Token has expired");
      }
      if (verifyError.name === "JsonWebTokenError") {
        throw new ApiError(401, "Invalid token structure");
      }
      throw new ApiError(401, "Token verification failed");
    }

    // Ensure the decoded token has the correct structure
    if (!decodedToken || !decodedToken._id) {
      console.error("Invalid token payload:", decodedToken);
      throw new ApiError(401, "Invalid token payload");
    }

    const user = await User.findById(decodedToken._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication Middleware Error:", error);

    if (!(error instanceof ApiError)) {
      const apiError = new ApiError(
        401,
        error.message || "Authentication failed"
      );
      next(apiError);
    } else {
      next(error);
    }
  }
});
