const mongoose = require("mongoose");
const UserSchema = require("../schemas/UserSchema");

const UserModel =
  mongoose.models.User || mongoose.model("User", UserSchema);

module.exports = UserModel;
