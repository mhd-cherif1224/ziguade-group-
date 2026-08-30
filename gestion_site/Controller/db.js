const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error("Database connection failed:", err.message);
        return;
    }

    console.log("Successfully connected to the MySQL database!");
    connection.release();
});

module.exports = pool.promise();