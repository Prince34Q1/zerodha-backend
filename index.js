require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const { HoldingsModel } = require("./model/HoldingsModel");
const { PositionsModel } = require("./model/PositionsModel");
const { OrdersModel } = require("./model/OrdersModel");
const User = require("./model/UserModel");

const authMiddleware = require("./middleware/authMiddleware");
const authRoutes = require("./routes/auth");

const app = express();

const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);

app.get("/allHoldings", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const allHoldings = await HoldingsModel.find({ userId });

  res.json(allHoldings);
});

app.get("/allPositions", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const allPositions = await PositionsModel.find({ userId });

  res.json(allPositions);
});

app.get("/funds", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const user = await User.findById(userId).select("balance");

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  res.json({
    balance: user.balance,
  });
});

app.post("/funds/add", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      message: "Enter a valid amount",
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  user.balance += amount;

  await user.save();

  res.json({
    message: "Funds added successfully",
    balance: user.balance,
  });
});

app.post("/funds/withdraw", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({
      message: "Enter a valid amount",
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  if (user.balance < amount) {
    return res.status(400).json({
      message: "Insufficient funds",
    });
  }

  user.balance -= amount;

  await user.save();

  res.json({
    message: "Funds withdrawn successfully",
    balance: user.balance,
  });
});

app.post("/newOrder", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { name, qty, price, mode } = req.body;

  const quantity = Number(qty);
  const stockPrice = Number(price);

  if (
    !name ||
    !mode ||
    !Number.isFinite(quantity) ||
    !Number.isFinite(stockPrice)
  ) {
    return res.status(400).json({
      message: "Invalid order details",
    });
  }

  if (quantity <= 0) {
    return res.status(400).json({
      message: "Quantity must be greater than 0",
    });
  }

  if (stockPrice <= 0) {
    return res.status(400).json({
      message: "Price must be greater than 0",
    });
  }

  if (mode !== "BUY" && mode !== "SELL") {
    return res.status(400).json({
      message: "Invalid order mode",
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      message: "User not found",
    });
  }

  const totalAmount = quantity * stockPrice;

  if (mode === "BUY") {
    if (user.balance < totalAmount) {
      return res.status(400).json({
        message: `Insufficient funds. Available balance: ₹${user.balance.toFixed(
          2
        )}`,
      });
    }

    user.balance -= totalAmount;

    await user.save();

    let holding = await HoldingsModel.findOne({
      name,
      userId,
    });

    if (holding) {
      const oldQty = Number(holding.qty);
      const newQty = oldQty + quantity;

      holding.avg =
        (oldQty * Number(holding.avg) + quantity * stockPrice) / newQty;

      holding.qty = newQty;
      holding.price = stockPrice;

      await holding.save();
    } else {
      const newHolding = new HoldingsModel({
        userId,
        name,
        qty: quantity,
        avg: stockPrice,
        price: stockPrice,
        net: "0%",
        day: "0%",
      });

      await newHolding.save();
    }

    let position = await PositionsModel.findOne({
      name,
      userId,
    });

    if (position) {
      const oldQty = Number(position.qty);
      const newQty = oldQty + quantity;

      position.avg =
        (oldQty * Number(position.avg) + quantity * stockPrice) / newQty;

      position.qty = newQty;
      position.price = stockPrice;

      await position.save();
    } else {
      const newPosition = new PositionsModel({
        userId,
        name,
        qty: quantity,
        avg: stockPrice,
        price: stockPrice,
        product: "CNC",
        day: "0%",
      });

      await newPosition.save();
    }
  }

  if (mode === "SELL") {
    const holding = await HoldingsModel.findOne({
      name,
      userId,
    });

    if (!holding) {
      return res.status(400).json({
        message: "You don't own this stock",
      });
    }

    if (Number(holding.qty) < quantity) {
      return res.status(400).json({
        message: `You only have ${holding.qty} shares`,
      });
    }

    holding.qty = Number(holding.qty) - quantity;

    if (holding.qty === 0) {
      await HoldingsModel.deleteOne({
        name,
        userId,
      });
    } else {
      await holding.save();
    }

    const position = await PositionsModel.findOne({
      name,
      userId,
    });

    if (position) {
      position.qty = Number(position.qty) - quantity;

      if (position.qty <= 0) {
        await PositionsModel.deleteOne({
          name,
          userId,
        });
      } else {
        await position.save();
      }
    }

    user.balance += totalAmount;

    await user.save();
  }

  const newOrder = new OrdersModel({
    userId,
    name,
    qty: quantity,
    price: stockPrice,
    mode,
  });

  await newOrder.save();

  res.status(200).json({
    message: `${mode} order placed successfully`,
    balance: user.balance,
  });
});

app.get("/allOrders", authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  const allOrders = await OrdersModel.find({ userId });

  res.json(allOrders);
});

app.listen(PORT, () => {
  console.log("App started!");

  mongoose
    .connect(uri)
    .then(() => {
      console.log("DB started!");
    })
    .catch((error) => {
      console.log("DB connection failed:", error.message);
    });
});