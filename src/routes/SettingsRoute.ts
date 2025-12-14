import { Router } from "express";
import { container } from "tsyringe";
import { authenticateToken } from "../middleware/auth";
import { SettingsController } from "../controllers/SettingsController";

export function createSettingsRouter(controller = container.resolve(SettingsController)) {
    const router = Router();

    router.get("/f2f-cookies", authenticateToken, controller.ensureManager, controller.getCookies);
    router.post("/f2f-cookies", authenticateToken, controller.ensureManager, controller.updateCookies);
    router.put("/f2f-cookies", authenticateToken, controller.ensureManager, controller.updateCookies);
    router.get("/earning-types", authenticateToken, controller.ensureManager, controller.getEarningTypes);
    router.get("/company", authenticateToken, controller.ensureManager, controller.getCompanySettings);
    router.put("/company", authenticateToken, controller.ensureManager, controller.updateCompanySettings);

    return router;
}

export default createSettingsRouter();
