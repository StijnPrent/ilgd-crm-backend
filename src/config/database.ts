import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    supportBigNumbers: true,
    bigNumberStrings:  true,
    // return DATE and DATETIME columns as raw strings so we can
    // interpret them in the Node process without driver timezone shifts
    dateStrings: ["DATE", "DATETIME"],
    // use the Node process timezone (Europe/Amsterdam via config/timezone)
    // so that stored datetimes match local expectations
    timezone: 'local'
});

export default pool;
