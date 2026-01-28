const net = require('net');

const client = new net.Socket();
client.connect(5434, '127.0.0.1', function () {
    console.log('Connected to port 5434');
    client.destroy();
});

client.on('error', function (err) {
    console.error('Connection error: ' + err.message);
});

client.on('close', function () {
    console.log('Connection closed');
});
