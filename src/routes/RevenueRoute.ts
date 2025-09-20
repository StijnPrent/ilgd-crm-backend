/**
 * RevenueRoute module.
 */
import {Router} from "express";
import {authenticateToken} from "../middleware/auth";
import {RevenueController} from "../controllers/RevenueController";

const router = Router();
const controller = new RevenueController();

router.get("/earnings", authenticateToken, controller.getEarnings.bind(controller));
router.get("/stats", authenticateToken, controller.getStats.bind(controller));

export default router;
