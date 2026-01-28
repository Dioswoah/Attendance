const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://attendance_user:Edgeoffaith12%40@127.0.0.1:5434/attendance_db',
    ssl: false
});

async function test() {
    try {
        console.log('Connecting to PG...');
        await client.connect();
        console.log('Connected!');
        const res = await client.query('SELECT NOW()');
        console.log('Query success:', res.rows[0]);
        await client.end();
    } catch (err) {
        console.error('PG Connect Error:', err);
        // console.error(JSON.stringify(err, null, 2));
    }
}

test();
