// backend/db.js

const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "oim_db",
  multipleStatements: true,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("✅ Connected to MySQL database.");
});

module.exports = db;
