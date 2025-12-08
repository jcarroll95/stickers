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
UserSchema.pre('save', function(next) {
    if (!this.isModified('password')) return next();

    bcrypt
        .genSalt(10)
        .then(salt => bcrypt.hash(this.password, salt))
        .then(hash => {
            this.password = hash;
            next();
        })
        .catch(next);
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

module.exports = mongoose.model('User', UserSchema);