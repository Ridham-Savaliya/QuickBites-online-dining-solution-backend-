import {google} from 'googleapis';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

// Validate required environment variables
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('Warning: Google OAuth credentials not found in environment variables');
  console.warn('Google login will not work without GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
}

const oauth2client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'postmessage'
)

export default oauth2client;