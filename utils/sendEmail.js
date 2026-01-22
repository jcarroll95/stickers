// This utility lets us send password reset emails to registered users upon request
const nodemailer = require('nodemailer');
const querystring = require("node:querystring");

const sendEmail = async (options) => {
    // Kill switch for all email functions
    if (process.env.EMAIL_ENABLED === 'false') {
        console.log('[EMAIL DISABLED] Would have sent:');
        console.log(`  To: ${options.email}`);
        console.log(`  Subject: ${options.subject}`);
        console.log(`  Message preview: ${options.message.substring(0, 100)}...`);
        return;
    }

    // Whitelist for test outside of production env
    if (process.env.NODE_ENV !== 'production') {
        const testDomains = ['@test.com', '@stickerboards.app', '@example.com'];
        const isTestEmail = testDomains.some(domain => options.email.endsWith(domain));
        if (!isTestEmail) {
            console.log(`[EMAIL BLOCKED] Refusing to send to ${options.email} in non-production`);
            return;
        }
    }


    // create transporter object
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    // send mail with transporter object
    const message = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
    };

    // send mail with defined transport object
    try {
        const info = await transporter.sendMail(message);
        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error(`[EMAIL ERROR] Failed to send email to ${options.email}`);
        console.error(`  Subject: ${options.subject}`);
        console.error(`  Error: ${error.message}`);
        throw error; // Re-throw so calling code can handle it
    }
}

module.exports = sendEmail;