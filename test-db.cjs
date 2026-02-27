
const { Client } = require('pg');

async function test() {
    const users = ['postgres', 'berozgar'];
    const passwords = ['postgres', 'password', 'berozgar123', 'admin', ''];
    const dbs = ['postgres', 'berozgar'];

    for (const user of users) {
        for (const password of passwords) {
            for (const database of dbs) {
                const client = new Client({
                    user,
                    host: 'localhost',
                    database,
                    password,
                    port: 5432,
                });
                try {
                    await client.connect();
                    console.log(`SUCCESS: user=${user}, password=${password}, database=${database}`);
                    await client.end();
                    return;
                } catch (err) {
                    // console.log(`FAILED: user=${user}, password=${password}, database=${database} - ${err.message}`);
                }
            }
        }
    }
    console.log('FAILED ALL COMBINATIONS');
}

test();
