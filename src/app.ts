import "reflect-metadata";
import "./container";
import express from "express";
import cors from "cors";
import userRoute from "./routes/UserRoute";
import chatterRoute from "./routes/ChatterRoute";
import employeeEarningRoute from "./routes/EmployeeEarningRoute";
import shiftRoute from "./routes/ShiftRoute";

const app = express();

// CORS FIRST
const allowList = [
    /^http:\/\/localhost:\d+$/,
    /^https:\/\/([a-z0-9-]+\.)*dashboardilgd\.com$/,
    /^https:\/\/([a-z0-9-]+\.)*vercel\.app$/,
];

const corsOptions: cors.CorsOptions = {
    origin(origin, cb) {
        // Allow tools (Postman/cURL) that have no Origin header
        if (!origin) return cb(null, true);

        const allowed = allowList.some((pattern) => pattern.test(origin));
        return allowed ? cb(null, true) : cb(new Error("Not allowed by CORS"));
    },

    // Let the 'cors' package reflect what the browser asks for.
    // (Do NOT hardcode allowedHeaders/methods unless necessary)
    optionsSuccessStatus: 204,
    // credentials: true, // only if you use cookies
};

// ---- CORS MUST be before everything else ----
app.use(cors(corsOptions));

// Explicitly handle all preflights
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
