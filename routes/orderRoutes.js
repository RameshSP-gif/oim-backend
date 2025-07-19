const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

router.post("/orders/:id/process", orderController.processOrder);
router.post("/restock-requests/:id/fulfill", orderController.fulfillRestock);
router.get("/restock-requests", orderController.getRestockRequests);

module.exports = router;
