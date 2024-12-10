import { Router } from "express";
import {
  RegisterUser,
  loginUser,
  logoutUser,
  refreshAccessToken
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

export default router;
