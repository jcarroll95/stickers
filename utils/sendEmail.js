// This utility lets us send password reset emails to registered users upon request
const nodemailer = require('nodemailer');
const querystring = require("node:querystring");

const sendEmail = async (options) => {
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
    const info = await transporter.sendMail(message);

    console.log("Message sent: %s", info.messageId);
}

module.exports = sendEmail;