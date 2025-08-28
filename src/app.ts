import "reflect-metadata";
import express from "express";
import cors from "cors";
import userRoute from "./routes/UserRoute";
import chatterRoute from "./routes/ChatterRoute";
import employeeEarningRoute from "./routes/EmployeeEarningRoute";
import shiftRoute from "./routes/ShiftRoute";

const app = express();

// CORS FIRST
const allowList = new Set([
    "http://localhost:3000",
    "https://dashboardilgd.com",
    "https://www.dashboardilgd.com",
    // "https://<your-preview>.vercel.app", // add if needed
]);

const corsOptions: cors.CorsOptions = {
    origin(origin, cb) {
        // Allow tools (Postman/cURL) that have no Origin header
        if (!origin) return cb(null, true);

        let ok = allowList.has(origin);
        if (!ok) {
            try {
                const host = new URL(origin).hostname;
                ok = host.endsWith("dashboardilgd.com") || host.endsWith(".vercel.app");
            } catch {}
        }
        return ok ? cb(null, true) : cb(new Error("Not allowed by CORS"));
    },

    // Let the 'cors' package reflect what the browser asks for.
    // (Do NOT hardcode allowedHeaders/methods unless necessary)
    optionsSuccessStatus: 204,
    // credentials: true, // only if you use cookies
};

// ---- CORS MUST be before everything else ----
app.use(cors(corsOptions));

// Handle all preflights (IMPORTANT: use RegExp, not "*")
app.options(/.*/, cors(corsOptions));

// (Optional) tiny logger while debugging
app.use((req, _res, next) => {
    if (req.method === "OPTIONS") {
        console.log("Preflight:", req.headers.origin, req.path,
            req.headers["access-control-request-method"],
            req.headers["access-control-request-headers"]);
    }
    next();
});

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Your routes keep the /api prefix
app.use("/api/users", userRoute);
app.use("/api/chatters", chatterRoute);
app.use("/api/employee-earnings", employeeEarningRoute);
app.use("/api/shifts", shiftRoute);

// simple health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

export default app;
