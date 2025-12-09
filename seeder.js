// DB seeder
console.log(process.argv);
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
Review = require('./models/Review');

// Connect to database
mongoose.connect(process.env.MONGO_URI);

// Read JSON data files from our data folder
const stickerboards = JSON.parse(
    fs.readFileSync(`${__dirname}/data/stickerboards.json`, "utf-8")
);
const stix = JSON.parse(
    fs.readFileSync(`${__dirname}/data/stix.json`, "utf-8")
);
const users = JSON.parse(
    fs.readFileSync(`${__dirname}/data/users.json`, "utf-8")
);
const reviews = JSON.parse(
    fs.readFileSync(`${__dirname}/data/reviews.json`, "utf-8")
);



// Import into db
// The mongodb models have _id dependencies as they're created, so if you delete everything and then import everything
// You'll create records of stix which are not associated to real stickerboard _id values, etc.
// We'll fix this by creating users first, reading the _id values
// then creating stickerboards, associating with user _id's
// then creating stix, associating with stickerboard _id's
// then creating reviews, associating with user _id's


const importData = async (cliFlag) => {
    try {
        if (cliFlag === 'stix') {
            await Stick.create(stix);
        } else if (cliFlag === 'reviews') {
            await Review.create(reviews);
        } else if (cliFlag === 'users') {
            await User.create(users);
        } else if (cliFlag === 'stickerboards') {
            console.log("stickerboards".pink);
            await Stickerboard.create(stickerboards);
        } else {
            await Stickerboard.create(stickerboards);
            await Stick.create(stix);
            await User.create(users);
            await Review.create(reviews);
            cliFlag = 'all'
        }
       // console.log(`Data imported: ${stickerboards.length} stickerboards`.green.inverse);
        console.log(`Data imported: ${cliFlag}`.blue.inverse);
        process.exit(0);
    } catch (err) {
        console.error(String(err).red.inverse);
        await mongoose.connection.close().catch(()=>{});
        process.exit(1)
    }
}

// Delete data
const deleteData = async (cliFlag) => {
    try {
        // Mongo-created IDs will become desync'd so comment out what you don't want to delete
        if (cliFlag === 'stix') {
            await Stick.deleteMany();
        } else if (cliFlag === 'reviews') {
            await Review.deleteMany();
        } else if (cliFlag === 'users') {
            await User.deleteMany();
        } else if (cliFlag === 'stickerboards') {
            await Stickerboard.deleteMany();
        } else {
            await Stickerboard.deleteMany();
            await Stick.deleteMany();
            await User.deleteMany();
            await Review.deleteMany();
            cliFlag = 'all';
        }
        console.log(`Data destroyed: ${cliFlag}`.red.inverse);
        process.exit(0);
    } catch (err) {
        console.error(String(err).red.inverse);
        await mongoose.connection.close().catch(()=>{});
        process.exit(1)
    }
}

// when we call this with node seeder.js, we'll want an argument to be passed to specify create or delete

if (process.argv[2] === '-import') {
    if (!process.argv[3]) {
        importData('all');
    } else {
        importData(process.argv[3]);
    }
} else if (process.argv[2] === '-delete') {
    if (!process.argv[3]) {
        deleteData('all');
    } else {
        deleteData(process.argv[3]);
    }

} else {
    console.log(`Error: ${process.argv[2]} is not a valid command`);
    process.exit(1);
}