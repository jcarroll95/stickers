const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require("jsonwebtoken");

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'A name is required']
    },
    email: {
        type: String,
        required: [true, 'Please add an email address'],
        unique: [true, 'Email address already registered'],
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please enter a valid email address'
        ]
    },
    role: {
        type: String,
        enum: ['user', 'vipuser'],
        default: 'user'
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// encrypt password with bcrypt before save
UserSchema.pre('save', async function(next) {
    const salt = await bcrypt.genSalt(10);  // 10 rounds recommended in documentation
    this.password = await bcrypt.hash(this.password, salt);
})

// sign jwt and return, we can call this from the controller
UserSchema.methods.getSignedJwtToken = function() {
    // jwt needs the payload (user id) and the secret (from our config)
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
}

// match user entered password to hashed password in db
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
}

module.exports = mongoose.model('User', UserSchema);