import {Router} from "express";
import {authenticateToken} from "../middleware/auth";
import {EmployeeEarningController} from "../controllers/EmployeeEarningController";

const router = Router();
const controller = new EmployeeEarningController();

router.get("/", authenticateToken, controller.getAll.bind(controller));
router.get("/:id", authenticateToken, controller.getById.bind(controller));
router.post("/", authenticateToken, controller.create.bind(controller));
router.put("/:id", authenticateToken, controller.update.bind(controller));
router.delete("/:id", authenticateToken, controller.delete.bind(controller));

export default router;
