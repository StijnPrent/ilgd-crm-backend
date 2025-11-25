/**
 * CompanyRoute module.
 */
import { Router } from "express";
import { CompanyController } from "../controllers/CompanyController";
import { authenticateToken } from "../middleware/auth";

const router = Router();
const controller = new CompanyController();

router.get("/", authenticateToken, controller.list.bind(controller));
router.get("/:id", authenticateToken, controller.get.bind(controller));
router.post("/", authenticateToken, controller.create.bind(controller));
router.put("/:id", authenticateToken, controller.update.bind(controller));
router.delete("/:id", authenticateToken, controller.delete.bind(controller));

export default router;
