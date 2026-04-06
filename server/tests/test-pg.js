
const { Client } = require('pg');

async function test() {
    console.log('Testing raw pg connection...');
    const client = new Client({
        user: 'postgres',
        host: '127.0.0.1',
        database: 'postgres',
        port: 5432,
    });
    try {
        await client.connect();
        console.log('SUCCESS: Connected with raw pg (no password)');
        const res = await client.query('SELECT current_database(), current_user');
        console.log('Data:', res.rows[0]);
        await client.end();
    } catch (err) {
        console.error('FAILED raw pg:', err.message);
    }
}

test();
