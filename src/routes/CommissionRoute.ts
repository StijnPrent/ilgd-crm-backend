/**
 * CommissionRoute module.
 */
import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { CommissionController } from "../controllers/CommissionController";

const router = Router();
const controller = new CommissionController();

router.get("/", authenticateToken, controller.getAll.bind(controller));
router.get("/totalCount", authenticateToken, controller.getTotalCount.bind(controller));
router.post("/update", controller.updateFromShifts.bind(controller));
router.get("/:id", authenticateToken, controller.getById.bind(controller));
router.post("/", authenticateToken, controller.create.bind(controller));
router.put("/:id", authenticateToken, controller.update.bind(controller));
router.delete("/:id", authenticateToken, controller.delete.bind(controller));

export default router;
