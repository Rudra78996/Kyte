async function main() {
  const email = `test-${Date.now()}@example.com`;
  const password = 'password123';
  
  console.log(`Registering new user: ${email}...`);
  const regRes = await fetch('http://localhost:3000/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!regRes.ok) {
    console.error('Registration failed:', await regRes.text());
    return;
  }
  
  const { accessToken } = await regRes.json();
  console.log('Got access token. Fetching connect URL...');
  
  const connectRes = await fetch('http://localhost:3000/auth/github/connect', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  
  if (!connectRes.ok) {
    console.error('Connect failed:', await connectRes.text());
    return;
  }
  
  const { url } = await connectRes.json();
  console.log('\n======================================================');
  console.log('Click this link to connect GitHub:');
  console.log(url);
  console.log('======================================================\n');
}

main();
