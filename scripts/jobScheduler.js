const cron = require('node-cron');
const { sendWelcomeEmails, sendInactivityEmails, sendMotivationalEmails } = require('./emailJobs');

// Welcome emails: Every 5 minutes
cron.schedule('*/5 * * * *', sendWelcomeEmails);

// Inactivity reminders: Daily at 9 AM
cron.schedule('0 9 * * *', sendInactivityEmails);

// Motivational emails: Mon/Wed/Fri at 10 AM
cron.schedule('0 10 * * 1,3,5', sendMotivationalEmails);
