import "reflect-metadata";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import userRoute from "./routes/UserRoute";
import chatterRoute from "./routes/ChatterRoute";
import employeeEarningRoute from "./routes/EmployeeEarningRoute";
import shiftRoute from "./routes/ShiftRoute";
import commissionRoute from "./routes/CommissionRoute";
import "./container";

const app = express();

const allowedOrigins = [
    "http://localhost:3000",
    "https://dashboardilgd.com",
    "https://www.dashboardilgd.com",
    // allow preview deployments if you use them:
    /\.vercel\.app$/,
].filter(Boolean);

const corsOptions: cors.CorsOptions = {
    origin(origin, cb) {
        // allow non-browser tools (no Origin) and exact/regex matches
        if (!origin) return cb(null, true);
        const ok =
            allowedOrigins.some((o) =>
                o instanceof RegExp ? o.test(origin) : o === origin
            );
        return ok ? cb(null, true) : cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
    // credentials: true, // only if you actually use cookies
};

// 1) Must come BEFORE routes
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/users", userRoute);
app.use("/api/chatters", chatterRoute);
app.use("/api/employee-earnings", employeeEarningRoute);
app.use("/api/shifts", shiftRoute);
app.use("/api/commissions", commissionRoute);

const server = createServer(app);

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
