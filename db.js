// backend/db.js

const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "ballast.proxy.rlwy.net",
  user: "root",
  password: "WjJmOBrxBYatyqzmPKEgtWUKLlfjfXNR",
  database: "oim_db",
  multipleStatements: true,
  port:25822,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("✅ Connected to MySQL database.");
});

module.exports = db;
