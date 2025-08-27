import {Router} from "express";
import {authenticateToken} from "../middleware/auth";
import {ShiftController} from "../controllers/ShiftController";

const router = Router();
const controller = new ShiftController();

router.get("/", authenticateToken, controller.getAll.bind(controller));
router.get("/:id", authenticateToken, controller.getById.bind(controller));
router.post("/", authenticateToken, controller.create.bind(controller));
router.put("/:id", authenticateToken, controller.update.bind(controller));
router.delete("/:id", authenticateToken, controller.delete.bind(controller));
router.post("/clock-in", authenticateToken, controller.clockIn.bind(controller));
router.post("/:id/clock-out", authenticateToken, controller.clockOut.bind(controller));
router.get("/time-entry/active/:chatterId", authenticateToken, controller.getActiveTimeEntry.bind(controller));

export default router;
