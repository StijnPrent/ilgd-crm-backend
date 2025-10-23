/**
 * ShiftRequestRoute module.
 */
import {Router} from "express";
import {authenticateToken} from "../middleware/auth";
import {ShiftRequestController} from "../controllers/ShiftRequestController";

const router = Router();
const controller = new ShiftRequestController();

router.get("/", authenticateToken, controller.getAll.bind(controller));
router.post("/", authenticateToken, controller.create.bind(controller));
router.patch("/:id", authenticateToken, controller.update.bind(controller));

export default router;
