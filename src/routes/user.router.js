import { Router } from "express";
import {
  RegisterUser,
  changeCurrentPassword,
  getCurrentUser,
  getHistory,
  getUserChannelProfile,
  loginUser,
  logoutUser,
  refreshAccessToken,
  updateAccountDetail,
  updateUserAvatar
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/Register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  RegisterUser
);

router.route("/Login").post(loginUser);
//secure route
router.route("/Logout").post(verifyJWT, logoutUser);
router.route("/Refresh-Token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account").patch(verifyJWT, updateAccountDetail);
router.route("/update-avatar").patch(
  verifyJWT,
  upload.single("avatar"),
 updateUserAvatar
); 
router.route("/update-cover-image").patch(
  verifyJWT,
  upload.single("coverImage"),
  updateUserAvatar
);
router.route("/c/:username").get(verifyJWT, getUserChannelProfile)
router.route("/history").get(verifyJWT, getHistory)
export default router;
