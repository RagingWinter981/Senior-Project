const mongoose = require('mongoose');

const LogIn = mongoose.model('LogIn', new mongoose.Schema({
  UserName: { type: String, required: true, },
  Password: { type: String, Required: true, },
}));
module.exports = LogIn;