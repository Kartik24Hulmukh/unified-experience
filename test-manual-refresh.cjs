async function testRefresh() {
    try {
        console.log('Fetching...');
        const res = await fetch('http://localhost:3001/api/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: '{}'
        });
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Data:', data);
    } catch (err) {
        console.error('Error:', err.message);
    }
}

testRefresh();
