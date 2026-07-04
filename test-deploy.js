const http = require('http');



async function run() {
  console.log('1. Registering user...');
  let email = `test-${Date.now()}@test.com`;
  let res = await request('POST', '/auth/register', {
    email,
    password: 'password123',
    username: 'testuser',
  });
  console.log('Register Response:', res.status, res.data);

  if (res.status !== 201 && res.status !== 200) {
    console.error('Failed to register');
    return;
  }
  const token = res.data.token; // assume token is returned, or login needed
  let actualToken = token;
  if (!actualToken) {
    console.log('Logging in...');
    res = await request('POST', '/auth/login', {
      email,
      password: 'password123',
    });
    actualToken = res.data.accessToken || res.data.token;
  }

  if (!actualToken) {
    console.error('No token obtained', res.data);
    return;
  }
  console.log('Token obtained.');

  console.log('2. Creating project...');
  res = await request('POST', '/projects', {
    name: 'Test Project',
    repoUrl: 'https://github.com/amannn/vite-react-starter.git',
    description: 'A test react app'
  }, actualToken);
  console.log('Project Response:', res.status, res.data);
  const projectId = res.data.id;
  const subdomain = res.data.subdomain;

  if (!projectId) return;

  console.log('3. Triggering deployment...');
  res = await request('POST', `/projects/${projectId}/deployments`, {
    repoUrl: 'https://github.com/amannn/vite-react-starter.git',
    branch: 'master',
    commitSha: 'HEAD',
    trigger: 'MANUAL',
  }, actualToken);
  
  console.log('Deployment Response:', res.status, res.data);
  const deployId = res.data.id;

  if (!deployId) return;

  console.log('4. Waiting for deployment to finish...');
  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    res = await request('GET', `/projects/${projectId}/deployments/${deployId}`, null, actualToken);
    const status = res.data.status;
    console.log(`Status: ${status}`);
    if (status === 'SUCCESS' || status === 'FAILED') {
      console.log('Final Deployment Data:', res.data);
      if (res.data.logs) {
         console.log('Logs saved in DB? (Count):', res.data.logs.length);
      }
      if (status === 'SUCCESS' && subdomain) {
        console.log(`5. Testing hosted URL: http://${subdomain}.localhost`);
        const serveRes = await request('GET', '/', null, null, subdomain);
        console.log(`Hosted URL Response Status: ${serveRes.status}`);
        console.log(`Hosted URL Body (first 100 chars): ${String(serveRes.data).substring(0, 100)}`);
      }
      break;
    }
  }
}

// Update the request function to allow passing a Host header
async function request(method, path, body = null, token = null, subdomain = null) {
  return new Promise((resolve, reject) => {
    const port = subdomain ? 80 : 3000;
    const req = http.request(
      `http://localhost:${port}${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(subdomain ? { Host: `${subdomain}.localhost` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

run().catch(console.error);
