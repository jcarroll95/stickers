const { welcomeEmailTemplate, inactivityEmailTemplate, motivationalEmailTemplate } = require('./emailTemplates');
const sendEmail = require('../utils/sendEmail.js');
const User = require('../models/User');

async function sendWelcomeEmails() {
    // For testing: use 24 hours in dev, 5 minutes in production
    const fiveMinutesAgo = new Date(Date.now() - (process.env.NODE_ENV === 'production' ? 5 * 60 * 1000 : 24 * 60 * 60 * 1000));

    const newUsers = await User.find({
        createdAt: { $gte: fiveMinutesAgo },
        welcomeEmailSent: { $ne: true }, // Use $ne: true instead of === false due to MongoDB boolean quirk
        isVerified: true,
        emailHardOff: { $ne: true }
    });

    console.log(`Found ${newUsers.length} users eligible for welcome emails`);

    var newUserCount = 0;
    for (const user of newUsers) {
        try {
            await sendEmail({
                email: user.email,
                subject: 'Welcome to Stickerboards!',
                message: welcomeEmailTemplate(user.name)
            });
            user.welcomeEmailSent = true;
        } catch (err) {
            console.error(`Failed to send welcome email to ${user.email}: ${err.message}`);
            continue;
        }
        user.lastEmailSent = new Date();
        await user.save();
        newUserCount++;
        if (newUserCount % 25 === 0 && newUserCount !== 0 ) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

async function sendInactivityEmails() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const inactiveUsers = await User.find({
        lastLoginAt: { $lt: sevenDaysAgo },
        lastEmailSent: { $lt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
        isVerified: true,
        emailHardOff: { $ne: true }
    });

    console.log(`Found ${inactiveUsers.length} users eligible for inactivity emails`);

    var inactiveUserCount = 0;
    for (const user of inactiveUsers) {
        try {
            await sendEmail({
                email: user.email,
                subject: 'Check-in from Stickerboards',
                message: inactivityEmailTemplate(user.name)
            });
            user.lastEmailSent = new Date();
        } catch (err) {
            console.error(`Failed to send inactivity email to ${user.email}: ${err.message}`);
            continue;
        }
        await user.save();
        inactiveUserCount++;
        if (inactiveUserCount % 25 === 0 && inactiveUserCount !== 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}


async function sendMotivationalEmails() {
    const usersMotivational = await User.find({
        'emailPreferences.motivationalEmails': true,
        lastLoginAt: { $lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        isVerified: true,
        lastEmailSent: { $lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        emailHardOff: { $ne: true }
    });

    console.log(`Found ${usersMotivational.length} users eligible for motivational emails`);

    var motivationalUserCount = 0;
    for (const user of usersMotivational) {
        try {
            await sendEmail({
                email: user.email,
                subject: 'Check-in from Stickerboards',
                message: motivationalEmailTemplate(user.name)
            });
            user.lastEmailSent = new Date();
        } catch (err) {
            console.error(`Failed to send motivational email to ${user.email}: ${err.message}`);
            continue;
        }
        await user.save();
        motivationalUserCount++;
        if (motivationalUserCount % 25 === 0 && motivationalUserCount !== 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

module.exports = { sendWelcomeEmails, sendInactivityEmails, sendMotivationalEmails };
