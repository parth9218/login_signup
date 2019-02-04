var nodemailer = require('nodemailer');
const mail = require('./config/email.js');

const email = mail.email_id;
const password = mail.password


module.exports.sendMail = (to, subject, body) => {
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth:   {
            user: email,
            pass: password
        }
    });
    var mailOptions = {
        from: email,
        to: to,
        subject: subject,
        text: body
    }
    
    transporter.sendMail(mailOptions, (err, info) => {
        if(err) return console.error(err.message);
    });
}

