/**
 * ModelRoute module.
 */
import {Router} from "express";
import {authenticateToken} from "../middleware/auth";
import {ModelController} from "../controllers/ModelController";

const router = Router();
const controller = new ModelController();

router.get("/", authenticateToken, controller.getAll.bind(controller));
router.get("/earnings", authenticateToken, controller.getEarnings.bind(controller));
router.get("/:id", authenticateToken, controller.getById.bind(controller));
router.post("/", authenticateToken, controller.create.bind(controller));
router.put("/:id", authenticateToken, controller.update.bind(controller));
router.delete("/:id", authenticateToken, controller.delete.bind(controller));

export default router;
