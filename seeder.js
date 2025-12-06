// DB seeder
const fs = require('fs');
const mongoose = require('mongoose');
const colors = require('colors');
const dotenv = require('dotenv');

// load env variables
dotenv.config({ path: './config/config.env' });

// load models
Stickerboard = require('./models/Stickerboard');
Stick = require('./models/Stick');
User = require('./models/User');

// Connect to database
mongoose.connect(process.env.MONGO_URI);

// Read JSON data files from our data folder
const stickerboards = JSON.parse(fs.readFileSync(`${__dirname}/data/stickerboards.json`, "utf-8"));
const stix = JSON.parse(fs.readFileSync(`${__dirname}/data/stix.json`, "utf-8"));
const users = JSON.parse(fs.readFileSync(`${__dirname}/data/users.json`, "utf-8"));


//
// Import into db
const importData = async () => {
    try {
        await Stickerboard.create(stickerboards);
        await Stick.create(stix);
        await User.create(users);
       // console.log(`Data imported: ${stickerboards.length} stickerboards`.green.inverse);
        console.log(`Data imported: ${stix.length} stix`.blue.inverse);
        process.exit(0);
    } catch (err) {
        console.error(err.red.inverse);
    }
}

//
// Delete data
const deleteData = async () => {
    try {
        // Mongo-created IDs will become desync'd so comment out what you don't want to delete
        await Stickerboard.deleteMany();
        await Stick.deleteMany();
        await User.deleteMany();
        console.log("Data destroyed".red.inverse);
        process.exit(0);
    } catch (err) {
        console.error(err.red.inverse);
    }
}

// when we call this with node seeder.js, we'll want an argument to be passed to specify create or delete

if (process.argv[2] === '-import') {
    importData();
} else if (process.argv[2] === '-delete') {
    deleteData();
} else {
    console.log(`Error: ${process.argv[2]} is not a valid command`);
    process.exit(1);
}