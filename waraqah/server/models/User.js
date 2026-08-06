const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ALL_ROLES } = require('../utils/roles');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'اسم المستخدم مطلوب'],
      unique: true,
      trim: true,
      minlength: 3
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: [true, 'الدور الوظيفي مطلوب'],
      enum: ALL_ROLES
    }
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

// لا نرجع passwordHash أبدًا في أي استجابة JSON
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
