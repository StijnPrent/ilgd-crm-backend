import {Router} from "express";
import {authenticateToken} from "../middleware/auth";
import {ChatterController} from "../controllers/ChatterController";

const router = Router();
const controller = new ChatterController();

router.get("/", authenticateToken, controller.getAll.bind(controller));
router.get("/online", authenticateToken, controller.getOnline.bind(controller));
router.get("/:id", authenticateToken, controller.getById.bind(controller));
router.post("/", authenticateToken, controller.create.bind(controller));
router.put("/:id", authenticateToken, controller.update.bind(controller));
router.delete("/:id", authenticateToken, controller.delete.bind(controller));

export default router;
