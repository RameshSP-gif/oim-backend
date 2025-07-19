const express = require("express");
const mysql = require("mysql2/promise");

const router = express.Router();

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "root",
  database: "oim_db",
});

// KPIs Route
router.get("/kpis", async (req, res) => {
  try {
    const [totalOrders] = await db.query("SELECT COUNT(*) as count FROM orders");
    const [totalSales] = await db.query("SELECT SUM(price * quantity) as sum FROM orders WHERE status = 'completed'");
    const [pendingOrders] = await db.query("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
    const [completedOrders] = await db.query("SELECT COUNT(*) as count FROM orders WHERE status = 'completed'");
    const [cancelledOrders] = await db.query("SELECT COUNT(*) as count FROM orders WHERE status = 'cancelled'");
    const [lowStockItems] = await db.query("SELECT COUNT(*) as count FROM inventory WHERE quantity < 5");

    const [ordersOverTime] = await db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM orders
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 7
    `);

    const [topProducts] = await db.query(`
      SELECT product_name, SUM(quantity) as total_quantity
      FROM orders
      GROUP BY product_name
      ORDER BY total_quantity DESC
      LIMIT 5
    `);

    res.json({
      totalOrders: totalOrders[0].count,
      totalSales: totalSales[0].sum || 0,
      pendingOrders: pendingOrders[0].count,
      completedOrders: completedOrders[0].count,
      cancelledOrders: cancelledOrders[0].count,
      lowStockItems: lowStockItems[0].count,
      ordersOverTime,
      topProducts,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

module.exports = router;
