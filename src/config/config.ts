// src/config/config.ts

import dotenv from "dotenv";
dotenv.config();

interface Config {
    port: number;
    nodeEnv: string;

    // Database
    dbHost: string;
    dbUser: string;
    dbPassword: string;
    dbName: string;
    dbPort: number;

    frontendUrl: string;

    // JWT
    jwtSecret: string;
    jwtExpiration: string;

    // Server
    serverUrl: string;
}

const config: Config = {
    port: Number(process.env.PORT) || 3002,
    nodeEnv: process.env.NODE_ENV || "development",

    dbHost: process.env.DB_HOST || "localhost",
    dbUser: process.env.DB_USER || "root",
    dbPassword: process.env.DB_PASSWORD || "",
    dbName: process.env.DB_NAME || "",
    dbPort: Number(process.env.DB_PORT) || 3306,

    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",

    jwtSecret: process.env.JWT_SECRET || "",
    jwtExpiration: process.env.JWT_EXPIRATION || "8h",

    serverUrl: process.env.SERVER_URL || "http://localhost:3002",
};

if (!config.jwtSecret) throw new Error("❌ Missing JWT_SECRET in .env");

export default config;
