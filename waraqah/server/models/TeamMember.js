const mongoose = require('mongoose');
const { ALL_ROLES } = require('../utils/roles');

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ALL_ROLES },
    photo: { type: String, default: null }, // مسار الملف على السيرفر
    bio: { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('TeamMember', teamMemberSchema);
