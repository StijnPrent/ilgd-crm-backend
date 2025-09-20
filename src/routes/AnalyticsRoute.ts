import {Router} from "express";
import {authenticateToken} from "../middleware/auth";
import {AnalyticsController} from "../controllers/AnalyticsController";

const router = Router();
const controller = new AnalyticsController();

router.get("/earnings-profit-trend", authenticateToken, controller.getEarningsProfitTrend.bind(controller));

export default router;
