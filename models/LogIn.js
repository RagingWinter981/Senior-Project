const mongoose = require('mongoose');

const LogIn = mongoose.model('LogIn', new mongoose.Schema({
  UserName: { type: String, required: true, },
  Password: { type: String, required: true, },
  PasswordResetToken: { type: String, required: false }, 
  PasswordResetExpires: { type: Date, required: false }, 
}));
module.exports = LogIn;