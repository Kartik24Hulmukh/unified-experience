async function testRequest() {
  const email = 'buyer@mctrgit.ac.in';
  const password = 'Buyer@1234';
  
  try {
    const loginRes = await fetch('http://127.0.0.1:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!loginRes.ok) return;
    const loginData = await loginRes.json();
    const accessToken = loginData.accessToken;
    const userId = loginData.user?.id;
    
    // 2. Find a listing to request
    const listingsRes = await fetch('http://127.0.0.1:3001/api/listings?module=resale', {
      headers: { 
        'Authorization': `Bearer ${accessToken}`
      }
    });
    const listingsData = await listingsRes.json();
    const items = listingsData.data || [];
    
    const candidates = items.filter(l => l.ownerId !== userId);
    console.log('Candidate Listings:', candidates.map(l => ({id: l.id, status: l.status, title: l.title})));

    const listing = candidates.find(l => l.status === 'APPROVED' || l.status === 'approved');
    if (!listing) {
      console.log('No APPROVED listing found to request');
      return;
    }

    console.log(`Requesting listing: ${listing.title} (${listing.id}) [Status: ${listing.status}]`);
    
    const reqRes = await fetch('http://127.0.0.1:3001/api/requests', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        listingId: listing.id,
        message: 'Testing API'
      })
    });
    
    console.log('Request response:', reqRes.status, await reqRes.text());
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testRequest();
