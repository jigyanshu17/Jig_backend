import { Router } from "express";
import { RegisterUser } from "../controllers/user.controller.js";
const router = Router();

router.route("/Register").post(RegisterUser);

export default router;