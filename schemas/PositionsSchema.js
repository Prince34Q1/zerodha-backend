const { Schema } = require("mongoose");

const PositionsSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  product: {
    type: String,
    default: "CNC",
  },

  name: {
    type: String,
    required: true,
  },

  qty: {
    type: Number,
    default: 0,
  },

  avg: {
    type: Number,
    default: 0,
  },

  price: {
    type: Number,
    default: 0,
  },

  net: {
    type: String,
    default: "0%",
  },

  day: {
    type: String,
    default: "0%",
  },

  isLoss: {
    type: Boolean,
    default: false,
  },
});

module.exports = { PositionsSchema };