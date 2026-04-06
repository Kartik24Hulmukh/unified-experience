
import pg from 'pg';
const { Client } = pg;

async function test() {
    const users = ['postgres', 'berozgar', 'sandip'];
    const passwords = ['postgres', 'password', 'berozgar123', 'berozgar_dev', 'admin', 'root', 'sandip', '123456', 'Admin@123', 'Admin@1234'];
    const dbs = ['postgres', 'berozgar', 'united_experience'];

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
