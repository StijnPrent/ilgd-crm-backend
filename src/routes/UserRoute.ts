/**
 * UserRoute module.
 */
import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import { UserController } from "../controllers/UserController";

/**
 * Router exposing user-related endpoints.
 */
const router = Router();
const controller = new UserController();

router.post("/login", controller.login.bind(controller));
router.get("/", authenticateToken, controller.getAll.bind(controller));
router.get("/:id", authenticateToken, controller.getById.bind(controller));
router.post("/", authenticateToken, controller.create.bind(controller));
router.put("/:id", authenticateToken, controller.update.bind(controller));
router.delete("/:id", authenticateToken, controller.delete.bind(controller));

export default router;
