const https = require('http');

const start = Date.now();
https.get('http://localhost:3000/api/user/dashboard', { headers: { "Cookie": "authjs.callback-url=http%3A%2F%2Flocalhost%3A3000%2Fuser; authjs.session-token=MY_SESSION_TOKEN_HERE" } }, (res) => { // we need a valid session token :(
});
