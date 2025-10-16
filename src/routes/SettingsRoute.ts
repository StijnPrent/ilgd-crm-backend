import { Router } from "express";
import { container } from "tsyringe";
import { authenticateToken } from "../middleware/auth";
import { SettingsController } from "../controllers/SettingsController";

export function createSettingsRouter(controller = container.resolve(SettingsController)) {
    const router = Router();

    router.get("/f2f-cookies", authenticateToken, controller.ensureManager, controller.getCookies);
    router.put("/f2f-cookies", authenticateToken, controller.ensureManager, controller.updateCookies);

    return router;
}

export default createSettingsRouter();
