/**
 * BonusRoute module.
 */
import { Router } from "express";
import { BonusController } from "../controllers/BonusController";
import { authenticateToken } from "../middleware/auth";

const router = Router();
const controller = new BonusController();

router.get("/rules", authenticateToken, controller.getRules.bind(controller));
router.post("/rules", authenticateToken, controller.createRule.bind(controller));
router.put("/rules/:ruleId", authenticateToken, controller.updateRule.bind(controller));
router.post("/rules/:ruleId/test", authenticateToken, controller.previewRule.bind(controller));
router.post("/run", authenticateToken, controller.run.bind(controller));
router.get("/awards", authenticateToken, controller.getAwards.bind(controller));
router.get("/progress", authenticateToken, controller.getProgress.bind(controller));

export default router;
