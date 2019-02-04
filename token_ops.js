const { OAuth2Client } = require('google-auth-library');
const CLIENT_ID = '962746158523-45hiehmmdusekjc1e1566m3n5c66i3ce.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

exports.verify = async (token) => {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: CLIENT_ID
    });
    const payload = ticket.getPayload();
    return {
        email: payload.email,
        name: payload.given_name,
        id: payload.sub
    };
}