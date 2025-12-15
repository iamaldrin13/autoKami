// Simple test script to trigger webhook
const url = 'http://localhost:3000/api/telegram/webhook';

// Mock Telegram Update
const update = {
  update_id: 123456789,
  message: {
    message_id: 1,
    from: {
      id: 999999999, // Fake Chat ID
      is_bot: false,
      first_name: 'Test',
      username: 'testuser'
    },
    chat: {
      id: 999999999, // Fake Chat ID
      first_name: 'Test',
      username: 'testuser',
      type: 'private'
    },
    date: Math.floor(Date.now() / 1000),
    text: '/kami 0' // Command to test
  }
};

console.log('Sending mock update to:', url);

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update)
  });

  if (response.ok) {
    console.log('✅ Webhook received update successfully (HTTP 200)');
  } else {
    console.error(`❌ Webhook failed: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error('Response:', text);
  }
} catch (error) {
  console.error('❌ Network error:', error);
}
