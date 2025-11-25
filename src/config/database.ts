/**
 * database module.
 */
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
    dateStrings: ["DATE", "DATETIME"],
    timezone: 'Z'
});

pool.on('connection', (connection) => {
    // Use callback API here; the event provides a non-promise connection instance
    connection.query("SET time_zone = '+00:00'", (err: unknown) => {
        if (err) {
            console.error('[db] Failed to enforce UTC time_zone', err);
        }
    });
});

export default pool;
