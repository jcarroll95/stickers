const crypto = require('crypto');
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
        enum: ['user', 'vipuser', 'admin'],
        default: 'user'
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false
    },
    // Email verification fields
    isVerified: {
        type: Boolean,
        default: false
    },
    verifyEmailToken: String,
    verifyEmailExpire: Date,
    verifyEmailAttempts: { type: Number, default: 0 },
    lastVerificationSentAt: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    cheersStickers: {
        type: [Number],
        default: [0, 1, 2, 3, 4]
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// encrypt password with bcrypt before save
UserSchema.pre('save', async function() {
    if (!this.isModified('password')) return; // no next here in async style
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// sign jwt and return, we can call this from the controller
UserSchema.methods.getSignedJwtToken = function() {
    // jwt needs the payload (user id) and the secret (from our config)
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });
}

// match user entered password to hashed password in db
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
}

// Generate and hash pw tokem
UserSchema.methods.getResetPasswordToken = function() {
    // generate tokem
    const resetToken = crypto.randomBytes(20).toString('hex');

    // hash token and set to reset pw token field
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // set timeout
    this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    // the original token not the hashed versiom
    return resetToken;
}

// Generate and hash a 6-digit email verification code
UserSchema.methods.getVerifyEmailToken = function() {
    // generate a 6-digit numeric code using crypto.randomInt for better entropy
    const numeric = (crypto.randomInt(0, 1000000)).toString().padStart(6, '0');

    // hash code and store
    this.verifyEmailToken = crypto
        .createHash('sha256')
        .update(numeric)
        .digest('hex');

    // expire in 15 minutes
    this.verifyEmailExpire = Date.now() + 15 * 60 * 1000;
    this.verifyEmailAttempts = 0;
    this.lastVerificationSentAt = new Date();

    return numeric; // return plain code for emailing (not stored)
}

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);