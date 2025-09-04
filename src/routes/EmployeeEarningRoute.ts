import {Router} from "express";
import {authenticateToken} from "../middleware/auth";
import {EmployeeEarningController} from "../controllers/EmployeeEarningController";

const router = Router();
const controller = new EmployeeEarningController();

router.use(authenticateToken);

router.get("/", controller.getAll.bind(controller));
router.get("/:id", controller.getById.bind(controller));
router.post("/", controller.create.bind(controller));
router.put("/:id", controller.update.bind(controller));
router.delete("/:id", controller.delete.bind(controller));

export default router;
