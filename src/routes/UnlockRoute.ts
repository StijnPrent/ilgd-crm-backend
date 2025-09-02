import {Router} from "express";
import {authenticateToken} from "../middleware/auth";
import {UnlockController} from "../controllers/UnlockController";

const router = Router();
const controller = new UnlockController();

router.get("/per-chatter", authenticateToken, controller.perChatter.bind(controller));

export default router;
