const db = require("../db"); // Adjust path if needed

// Process an order and handle stock logic
const processOrder = (req, res) => {
  const orderId = req.params.id;

  db.query("SELECT * FROM orders WHERE id = ?", [orderId], (err, orderResults) => {
    if (err || orderResults.length === 0) {
      return res.status(404).json({ msg: "Order not found" });
    }

    const order = orderResults[0];
    const { product_name, quantity } = order;

    db.query("SELECT * FROM inventory WHERE item_name = ?", [product_name], (err, inventoryResults) => {
      if (err || inventoryResults.length === 0) {
        return res.status(404).json({ msg: "Item not found in inventory" });
      }

      const item = inventoryResults[0];

      if (item.quantity >= quantity) {
        // Fulfill the order
        db.query("UPDATE inventory SET quantity = quantity - ? WHERE id = ?", [quantity, item.id], (err) => {
          if (err) return res.status(500).json({ msg: "Inventory update failed" });

          db.query("UPDATE orders SET status = 'completed' WHERE id = ?", [orderId], (err) => {
            if (err) return res.status(500).json({ msg: "Order update failed" });

            res.json({ msg: "Order processed successfully" });
          });
        });
      } else {
        const needed = quantity - item.quantity;

        db.query(
          "INSERT INTO restock_requests (item_name, quantity_needed) VALUES (?, ?)",
          [product_name, needed],
          (err) => {
            if (err) return res.status(500).json({ msg: "Restock creation failed" });

            db.query("UPDATE orders SET status = 'pending' WHERE id = ?", [orderId], (err) => {
              if (err) return res.status(500).json({ msg: "Failed to mark order pending" });

              res.json({ msg: `Stock insufficient. Restock request created for ${needed} items.` });
            });
          }
        );
      }
    });
  });
};

// Fulfill a restock request
const fulfillRestock = (req, res) => {
  const requestId = req.params.id;

  db.query("SELECT * FROM restock_requests WHERE id = ?", [requestId], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ msg: "Restock request not found" });

    const request = results[0];

    db.query(
      "UPDATE inventory SET quantity = quantity + ? WHERE item_name = ?",
      [request.quantity_needed, request.item_name],
      (err) => {
        if (err) return res.status(500).json({ msg: "Failed to update inventory" });

        db.query("UPDATE restock_requests SET status = 'fulfilled' WHERE id = ?", [requestId], (err) => {
          if (err) return res.status(500).json({ msg: "Failed to update restock status" });

          res.json({ msg: "Restock fulfilled and inventory updated" });
        });
      }
    );
  });
};

// Get all restock requests
const getRestockRequests = (req, res) => {
  db.query("SELECT * FROM restock_requests", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};

module.exports = {
  processOrder,
  fulfillRestock,
  getRestockRequests,
};
