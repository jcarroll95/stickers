// DB seeder script to load the database with test data or clear it out
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
Comment = require('./models/Comment');

// Connect to MongoDB database
if (process.env.NODE_ENV === 'test') {
    console.error('Seeder should not be run in test environment'.red);
    process.exit(1);
}
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
const comments = JSON.parse(
    fs.readFileSync(`${__dirname}/data/comments.json`, "utf-8")
);

// Import into db the selected /data/ files
const importData = async (cliFlag) => {
    try {
        if (cliFlag === 'stix') {
            await Stick.create(stix);
        } else if (cliFlag === 'comments') {
            await Comment.create(comments);
        } else if (cliFlag === 'users') {
            await User.create(users);
        } else if (cliFlag === 'stickerboards') {
            console.log("stickerboards".pink);
            await Stickerboard.create(stickerboards);
        } else {
            await Stickerboard.create(stickerboards);
            await Stick.create(stix);
            await User.create(users);
            await Comment.create(comments);
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

// Delete selected data from the db
const deleteData = async (cliFlag) => {
    try {
        // Mongo-created IDs will become desync'd so remove what you don't want to delete
        if (cliFlag === 'stix') {
            await Stick.deleteMany();
        } else if (cliFlag === 'comments') {
            await Comment.deleteMany();
        } else if (cliFlag === 'users') {
            await User.deleteMany();
        } else if (cliFlag === 'stickerboards') {
            await Stickerboard.deleteMany();
        } else if (cliFlag === 'index') {
            await Stickerboard.collection.dropIndex("name_1");
            await Stickerboard.syncIndexes();
        } else {
            await Stickerboard.deleteMany();
            await Stick.deleteMany();
            await User.deleteMany();
            await Comment.deleteMany();
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

// Node seeder.js -import/-delete cliFlag
// argument [2] chooses import or delete
// argument [3] chooses subset of data or all
if (process.env.NODE_ENV === 'development') {
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
}