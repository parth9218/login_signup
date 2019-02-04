var express = require('express');
var crypto = require('crypto');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var { sendMail } = require('./sendMail.js');
var morgan = require('morgan');
var User = require('./models/user');
var { verify } = require('./token_ops');
const { google } = require('googleapis');


let active_users = new Map();
let forget_users = new Map();

// invoke an instance of express application.
var app = express();

// set our application port
app.set('port', 8080);

// set morgan to log info about our requests for development use.
app.use(morgan('dev'));

// initialize body-parser to parse incoming parameters requests to req.body
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// initialize cookie-parser to allow us access the cookies stored in the browser. 
app.use(cookieParser());

// initialize express-session to allow us track the logged-in user across sessions.
app.use(session({
    key: 'user_sid',
    secret: 'somerandonstuffs',
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 600000,
    }
}));

// This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
// This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
        res.clearCookie('user_sid');        
    }
    next();
});


// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
    if (req.session.user && req.cookies.user_sid) {
        res.redirect('/dashboard');
    } else {
        next();
    }    
};



// route for Home-Page
app.get('/', sessionChecker, (req, res) => {
    res.redirect('/login');
});


// route for user signup
app.route('/signup')
    .get(sessionChecker, (req, res) => {
        res.sendFile(__dirname + '/public/signup.html');
    })
    .post((req, res) => {
        User.create({
            username: req.body.username,
            email: req.body.email,
            name: req.body.name,
            password: req.body.password,
            sign_in_type: 'normal',
            verified: false
        })
        .then(user => {
            req.session.user = user.dataValues;
            active_users.set(req.session.user.id, req.session.user);
            res.redirect('/dashboard');
        })
        .catch(error => {
            res.redirect('/signup');
        });
});

// route for user Login
app.route('/login')
.get(sessionChecker, (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
})
.post((req, res) => {
    var username = req.body.username,
        password = req.body.password;
    User.findOne({ where: { username: username, sign_in_type: 'normal' } }).then(function (user) {
        if (!user) {
            res.redirect('/login');
        }
        else if(user.sign_in_type != 'normal')   {
            res.redirect('/login');
        }
        else if (!user.validPassword(password)) {
            res.redirect('/login');
        } else {
            req.session.user = user.dataValues;
            active_users.set(req.session.user.id, req.session.user);
            res.redirect('/dashboard');
        }
    });
});


// route for user's dashboard
app.get('/dashboard', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        res.sendFile(__dirname + '/public/dashboard.html');
    } else {
        res.redirect('/login');
    }
});


// route for user logout
app.get('/logout', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        console.log('asdf');
        res.clearCookie('user_sid');
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});


app.post('/google_user', (req, res) => {
    let profile = req.body;
    verify(profile.id_token).then(
        data => {
            User.findOne({ where:  { username: data.id }}).then(
                function(user)  {
                    if(!user)   {
                        User.create({ username: data.id, email: data.email, name: data.name, password: '', sign_in_type: 'google', verified: true}).then(
                            user => { 
                                req.session.user = user.dataValues   
                                res.sendFile('/dashboard');
                             }
                        ).catch(error => {
                            console.error(error);
                        });
                    }
                    else    {
                        req.session.user = user.dataValues;
                        res.redirect('/dashboard');
                    }
                }
            )
        }
    ).catch(error => {
        console.error(`Invalid id_token: ${error}`);
    })
});

app.route('/forgotpassword')
.get(sessionChecker, (req, res) => {
    res.sendFile(__dirname + '/public/forgotpassword.html');
})
.post((req, res) => {
    const email = req.body.email;
    User.findOne({ where: {email: email}}).then(user => {
        if(!user)   {
            res.status(401).send('Invalid email address');
        }
        else if(user)   {
            let nonce = encodeURIComponent(crypto.randomBytes(64).toString('base64'));
            let link = `http://localhost:${app.get('port')}/resetpassword?token=${nonce}`;
            sendMail(email, 'Reset Password Link', link);
            forget_users.set(nonce,  user);
            res.redirect('/');
        }
    }).catch(error => {
        console.error(error);
    });
});

app.route('/resetpassword')
.get(sessionChecker, (req, res) => {
    let token = encodeURIComponent(req.query.token);
    let user = forget_users.get(token);

    if(!user)  {
        res.redirect('/');
    }
    else    {
        res.cookie('token', token);
        res.sendFile(__dirname + '/public/resetpassword.html');
    }
}).post((req, res) => {
    let token = req.cookies['token'];
    let user = forget_users.get(token);

    if(!user)  {
        res.redirect('/');
    }
    else    {
        user.update({ password: req.body.password });
        forget_users.delete(token);
        res.clearCookie('token');
        res.redirect('/');
    }
});

// route for handling 404 requests(unavailable routes)
app.use(function (req, res, next) {
  res.status(404).send("Sorry can't find that!")
});

app.listen(app.get('port'), () => console.log(`App started on port ${app.get('port')}`));