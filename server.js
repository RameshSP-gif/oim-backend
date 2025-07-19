const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dashboardRoutes = require("./routes/dashboardRoutes"); // KPIs routes
const orderRoutes = require("./routes/orderRoutes");


const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use("/", orderRoutes);


// DB connection
const db = mysql.createConnection({
  host: "ballast.proxy.rlwy.net",
  user: "root",
  password: "WjJmOBrxBYatyqzmPKEgtWUKLlfjfXNR",
  database: "oim_db",
  port:25822,
  multipleStatements: true,
});

// Middleware: verify token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) return res.status(401).json({ msg: "No token" });

  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "Token format invalid" });

  jwt.verify(token, "secretkey", (err, decoded) => {
    if (err) return res.status(403).json({ msg: "Invalid token" });
    req.user = decoded;
    next();
  });
};

// Auth: Register
app.post("/register", async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ msg: "Missing fields" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  db.query(
    "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
    [username, hashedPassword, role],
    (err) => {
      if (err) return res.status(500).json(err);
      res.status(201).json({ msg: "User registered" });
    }
  );
});

// Auth: Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, results) => {
      if (err) return res.status(500).json(err);
      if (results.length === 0) return res.status(404).json({ msg: "User not found" });

      const valid = await bcrypt.compare(password, results[0].password);
      if (!valid) return res.status(401).json({ msg: "Invalid password" });

      const token = jwt.sign(
        { id: results[0].id, username: results[0].username, role: results[0].role },
        "secretkey",
        { expiresIn: "1d" }
      );

      res.json({ token, user: { username: results[0].username, role: results[0].role } });
    }
  );
});

// GET all users (protected)
app.get("/users", verifyToken, (req, res) => {
  db.query("SELECT id, username FROM users", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

// Inventory CRUD
app.get("/inventory", (req, res) => {
  db.query("SELECT * FROM inventory", (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

app.post("/inventory", (req, res) => {
  const { store, item_name, quantity } = req.body;
  if (!store || !item_name || !quantity)
    return res.status(400).json({ msg: "Missing fields" });

  db.query(
    "INSERT INTO inventory (store, item_name, quantity) VALUES (?, ?, ?)",
    [store, item_name, quantity],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ id: result.insertId, store, item_name, quantity });
    }
  );
});

app.put("/inventory/:id", (req, res) => {
  const { store, item_name, quantity } = req.body;
  db.query(
    "UPDATE inventory SET store=?, item_name=?, quantity=? WHERE id=?",
    [store, item_name, quantity, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ msg: "Inventory updated" });
    }
  );
});

app.delete("/inventory/:id", (req, res) => {
  db.query("DELETE FROM inventory WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ msg: "Inventory deleted" });
  });
});

// Stores CRUD
app.get("/stores", (req, res) => {
  db.query("SELECT * FROM stores", (err, rows) => {
    if (err) return res.status(500).json(err);
    res.json(rows);
  });
});

app.post("/stores", (req, res) => {
  const { name, location } = req.body;
  if (!name || !location)
    return res.status(400).json({ msg: "Missing store fields" });

  db.query(
    "INSERT INTO stores (name, location) VALUES (?, ?)",
    [name, location],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.status(201).json({ id: result.insertId, name, location });
    }
  );
});

app.put("/stores/:id", (req, res) => {
  const { name, location } = req.body;
  db.query(
    "UPDATE stores SET name=?, location=? WHERE id=?",
    [name, location, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ msg: "Store updated" });
    }
  );
});

app.delete("/stores/:id", (req, res) => {
  db.query("DELETE FROM stores WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ msg: "Store deleted" });
  });
});

// Suppliers
app.get("/suppliers", (req, res) => {
  db.query("SELECT * FROM suppliers", (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json(rows);
  });
});

app.post("/suppliers", (req, res) => {
  const { name, contact } = req.body;
  if (!name || !contact)
    return res.status(400).json({ msg: "Missing supplier fields" });

  db.query(
    "INSERT INTO suppliers (name, contact) VALUES (?, ?)",
    [name, contact],
    (err, result) => {
      if (err) return res.status(500).json(err);
      res.status(201).json({ id: result.insertId, name, contact });
    }
  );
});

// Orders
/*app.get("/orders", (req, res) => {
  db.query("SELECT * FROM orders", (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
}); */

app.get("/orders", verifyToken, (req, res) => {
  const username = req.user.username;
  const role = req.user.role;

  const query = role === "admin"
    ? "SELECT * FROM orders"
    : "SELECT * FROM orders WHERE customer_name = ?";

  const params = role === "admin" ? [] : [username];

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});


app.get("/orders/:id", (req, res) => {
  db.query("SELECT * FROM orders WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ msg: "Order not found" });
    res.json(results[0]);
  });
});

app.post("/orders", (req, res) => {
  const { customer_name, product_name, quantity, price, transaction_id, payment_method, status } = req.body;

  if (!customer_name || !product_name || !quantity || !price || !transaction_id || !payment_method || !status) {
    return res.status(400).json({ msg: "Missing fields" });
  }

  db.query(
    "INSERT INTO orders (customer_name, product_name, quantity, price, transaction_id, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [customer_name, product_name, quantity, price, transaction_id, payment_method, status],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      res.status(201).json({ msg: "Order created", orderId: result.insertId });
    }
  );
});

app.put("/orders/:id", (req, res) => {
  const { customer_name, product_name, quantity, price, transaction_id, payment_method, status } = req.body;
  db.query(
    "UPDATE orders SET customer_name=?, product_name=?, quantity=?, price=?, transaction_id=?, payment_method=?, status=? WHERE id=?",
    [customer_name, product_name, quantity, price, transaction_id, payment_method, status, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err });
      res.json({ msg: "Order updated" });
    }
  );
});

app.delete("/orders/:id", (req, res) => {
  db.query("DELETE FROM orders WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ msg: "Order deleted" });
  });
});

// Dashboard summary route
app.get("/dashboard/metrics", verifyToken, (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ msg: "Access denied. Admins only." });
  }

  const metrics = {
    totalOrders: 0,
    totalInventoryItems: 0,
    totalSuppliers: 0,
    totalStores: 0,
  };

  const queries = [
    { sql: "SELECT COUNT(*) AS total FROM orders", key: "totalOrders" },
    { sql: "SELECT COUNT(*) AS total FROM inventory", key: "totalInventoryItems" },
    { sql: "SELECT COUNT(*) AS total FROM suppliers", key: "totalSuppliers" },
    { sql: "SELECT COUNT(*) AS total FROM stores", key: "totalStores" },
  ];

  let completed = 0;

  queries.forEach((q) => {
    db.query(q.sql, (err, results) => {
      if (err) return res.status(500).json({ error: err });

      metrics[q.key] = results[0].total;
      completed++;

      if (completed === queries.length) {
        res.json(metrics);
      }
    });
  });
});

// ✅ USE the dashboard routes (includes /dashboard/kpis)
app.use("/dashboard", dashboardRoutes);



// ✅ BACKEND - EXPRESS SERVER (update server.js)
// Fulfill order endpoint
app.put("/orders/:id/fulfill", (req, res) => {
  const orderId = req.params.id;

  db.query("SELECT * FROM orders WHERE id = ?", [orderId], (err, orders) => {
    if (err) return res.status(500).json({ error: err });
    if (orders.length === 0) return res.status(404).json({ msg: "Order not found" });

    const order = orders[0];

    db.query("SELECT * FROM inventory WHERE item_name = ?", [order.product_name], (err, inventory) => {
      if (err) return res.status(500).json({ error: err });
      if (inventory.length === 0)
        return res.status(404).json({ msg: "Inventory item not found" });

      const item = inventory[0];
      if (item.quantity < order.quantity) {
        return res.status(400).json({ msg: "Not enough inventory to fulfill order" });
      }

      const newQty = item.quantity - order.quantity;
      db.query("UPDATE inventory SET quantity = ? WHERE id = ?", [newQty, item.id], (err) => {
        if (err) return res.status(500).json({ error: err });

        db.query("UPDATE orders SET status = 'completed' WHERE id = ?", [orderId], (err) => {
          if (err) return res.status(500).json({ error: err });

          let restockMsg = null;
          if (newQty < 5) {
            restockMsg = `Low stock for '${item.item_name}'. Please reorder from supplier.`;
          }

          res.json({
            msg: "Order fulfilled and inventory updated",
            lowStockAlert: restockMsg
          });
        });
      });
    });
  });
});


// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
