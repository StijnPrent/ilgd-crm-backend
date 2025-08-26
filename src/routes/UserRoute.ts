import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {UserController} from "../controllers/UserController";

const router = Router();
const controller = new UserController();

// Authentication & Company creation
router.post("/login", controller.login.bind(controller));

export default router;