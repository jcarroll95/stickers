// /config/db.js
// This is our implementation of how we will connect to the DB
// It's not the only way to do it, just a way
const mongoose = require('mongoose');

const connectDB = async () => {
// mongoose connect returns a promise, we could use 
// mongoose.connect().then() but we'll use async await instead
// we'll pass in some settings to avoid warnings

    const conn = await mongoose.connect(process.env.MONGO_URI);
    /* These are defaults now, using them in this manner is deprecated
    , {
        useNewUrlParser: true,
        useCreateIndex: true,
        useFindAndModify: false,
        useUnifiedTopology: true
    });*/
    console.log(`MongoDB Connected: ${conn.connection.host}`);

}

module.exports = connectDB;
