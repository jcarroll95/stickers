// /config/db.js
// This is our implementation of how we will connect to the DB
// It's not the only way to do it, just a way
const mongoose = require('mongoose');

const connectDB = async () => {
    // Extra safety: never connect to a real DB if we are in test mode
    if (process.env.NODE_ENV === 'test') {
        console.error('Attempted to call connectDB() in test environment. Skipping.'.red);
        return;
    }

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
