const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');
const destroyer = require('server-destroy');

// Replace with your OAuth client credentials
const CLIENT_ID = '1179858114-88n38dbnt2cs3atk38a18c9g0e8g46eo.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:5000/api/admin/youtube-callback';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Generate a url that asks permissions for YouTube scopes
const scopes = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube'
];

async function main() {
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent' // Force to get refresh token
  });

  // Open the browser for the user to authorize
  console.log('Opening browser for authorization...');
  open(authorizeUrl, {wait: false});

  // Create a local server to receive the callback
  const server = http.createServer(async (req, res) => {
    try {
      // Get the code from the callback URL
      const qs = new url.URL(req.url, 'http://localhost:5000').searchParams;
      const code = qs.get('code');
      
      if (code) {
        // Exchange the code for tokens
        const {tokens} = await oauth2Client.getToken(code);
        console.log('\n\n--- SAVE THESE TOKENS IN YOUR .ENV FILE ---');
        console.log('Refresh Token:', tokens.refresh_token);
        console.log('Access Token:', tokens.access_token);
        console.log('Token Type:', tokens.token_type);
        console.log('Expiry Date:', tokens.expiry_date);
        console.log('Scope:', tokens.scope);
        console.log('----------------------------------------\n\n');
        
        // Send success response to browser
        res.end('Authentication successful! You can close this window.');
      }
    } catch (e) {
      console.error('Error getting tokens:', e);
      res.end('Error: ' + e.message);
    } finally {
      // Close the server
      server.destroy();
    }
  }).listen(5000, () => {
    console.log('Temporary server listening on port 5000');
  });
  
  destroyer(server);
}

main().catch(console.error);