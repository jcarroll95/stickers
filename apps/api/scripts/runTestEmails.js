require('dotenv').config({ path: './config/config.env' });
const mongoose = require('mongoose');
const { sendWelcomeEmails, sendInactivityEmails, sendMotivationalEmails } = require('./emailJobs');

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const jobType = process.argv[2] || 'welcome';

        console.log(`\nRunning ${jobType} email job...\n`);

        switch(jobType) {
            case 'welcome':
                await sendWelcomeEmails();
                break;
            case 'inactivity':
                await sendInactivityEmails();
                break;
            case 'motivational':
                await sendMotivationalEmails();
                break;
            case 'all':
                await sendWelcomeEmails();
                await sendInactivityEmails();
                await sendMotivationalEmails();
                break;
            default:
                console.log('Unknown job type. Use: welcome, inactivity, motivational, or all');
        }

        console.log('\nJob completed!');
        process.exit(0);
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });