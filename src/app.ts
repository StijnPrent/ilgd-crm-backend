import "reflect-metadata";
import "./container";
import express from "express";
import cors from "cors";
import userRoute from "./routes/UserRoute";
import chatterRoute from "./routes/ChatterRoute";
import employeeEarningRoute from "./routes/EmployeeEarningRoute";
import shiftRoute from "./routes/ShiftRoute";

const app = express();

// 1) Explicit allowlist (no "*")
const allowlist = new Set([
    "http://localhost:3000",
    "https://dashboardilgd.com",
    "https://www.dashboardilgd.com",
    // add preview URLs if needed, e.g. "https://dashboardilgd-git-main-<user>.vercel.app"
]);

const corsOptions: cors.CorsOptions = {
    origin(origin, cb) {
        console.log(allowlist);
        console.log("origin", origin);
        // allow tools like curl/Postman (no origin)
        if (!origin) return cb(null, true);
        return allowlist.has(origin) ? cb(null, true) : cb(new Error("Not allowed by CORS"));
    },
    credentials: true, // only keep this if you actually need cookies/Authorization
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
};

// 2) CORS must run before body parsers/routes; include OPTIONS
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // handle preflight for all routes

// 3) Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4) Routes
app.use("/api/users", userRoute);
app.use("/api/chatters", chatterRoute);
app.use("/api/employee-earnings", employeeEarningRoute);
app.use("/api/shifts", shiftRoute);

// 5) Health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

export default app;
