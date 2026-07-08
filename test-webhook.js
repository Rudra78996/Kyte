const crypto = require('crypto');

// Need to match the one in .env
const secret = process.env.GITHUB_WEBHOOK_SECRET || 'test_secret';

const payload = {
  ref: 'refs/heads/main',
  after: '1234567890abcdef1234567890abcdef12345678',
  deleted: false,
  repository: {
    html_url: 'https://github.com/Rudra78996/Test',
  },
  head_commit: {
    message: 'Test webhook push'
  }
};

const rawBody = JSON.stringify(payload);
const hmac = crypto.createHmac('sha256', secret);
hmac.update(rawBody);
const signature = `sha256=${hmac.digest('hex')}`;

async function main() {
  console.log('Sending webhook request...');
  const res = await fetch('http://localhost/api/webhooks/github', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-github-event': 'push',
      'x-github-delivery': `test-delivery-${Date.now()}`,
      'x-hub-signature-256': signature,
    },
    body: rawBody
  });
  
  console.log(`Status: ${res.status}`);
  console.log(`Body:`, await res.text());
}

main();
