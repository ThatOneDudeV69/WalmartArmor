# WalmartArmor
A self hosted open source key system you can use for your scripts.

## Setup Guide
### 1. Database Creation
 1. Go to the Cloudflare Dashboard and navigate to **Workers & Pages** > **D1**.
 2. Create a new database named keysystem.
 3. In the **Console** tab, execute the following SQL to initialize the table:
```sql
CREATE TABLE keys (
    key TEXT PRIMARY KEY,
    hwid TEXT,
    discord_id TEXT,
    blacklisted INTEGER DEFAULT 0,
    reset_state INTEGER DEFAULT 1,
    total_executions INTEGER DEFAULT 0,
    expiry INTEGER,
    note TEXT
);

```
### 2. Environment Configuration
Navigate to your Worker's **Settings** > **Variables** and add the following:
**D1 Database Bindings:**
 * Variable name: DB
 * Database: keysystem
**Environment Variables:**
 * API_KEY: Used to access the API. Keep this private at all costs.
 * SECRET1, SECRET2, SECRET3: Shared secrets used for authentication.
 * WORKINK_LINK_ID: The ID from your work.ink to ensure all tokens are obtained from the official work.ink page.
 * KEY_TIME_OFFSET: Number of hours a key remains valid (e.g., 48).
### 3. Deployment
 1. Ensure you have all previous steps done.
 2. Run npm run deploy via Wrangler.
## API Usage Guide
### Authentication
All requests to the /api/* endpoints require the Authorization header.
Authorization: YOUR_API_KEY
### Endpoints
#### GET /sync
Returns the current Unix timestamp of the server. Use this to prevent local clock manipulation on the client.
#### GET /redeem?token=TOKEN_HERE
Redeems a Work.ink token.
 * **Returns:** A 32-character license key string on success.
 * **Error Codes:** Missing token, Invalid token, Invalid link origin.
#### POST /api/users
Fetch or search for users in the database.
**Body (JSON):**
 * discord_id: (Optional) Filter by Discord ID.
 * user_key: (Optional) Filter by specific key.
 * search: (Optional) String search across keys and notes.
 * from/until: (Optional) Pagination offsets.
#### POST /api/users/resethwid
Clears the HWID tied to a key and sets reset_state to 1, allowing the next user who launches the client to claim the key.
**Body (JSON):** { "user_key": "THE_KEY" }
#### POST /api/users/blacklist
Bans a specific key.
**Body (JSON):** * user_key: The key to ban.
 * ban_expire: (Optional) Unix timestamp for ban expiry. Defaults to -1 (permanent).
#### POST /api/users/unblacklist
Removes a ban from a key.
**Body (JSON):** { "user_key": "THE_KEY" }
## Client Verification Logic
The /verify endpoint expects specific headers to prevent request spoofing.
### Required Headers:
 * clienttime: Current Unix timestamp.
 * clientkey: The user's license key.
 * clientnonce: A random unique string for the session.
 * externalsignature: A SHA-256 hash of the following concatenation:
   clientnonce + SECRET1 + clientkey + SECRET2 + clienttime + SECRET3
 * X-Fingerprint: (Or any header ending in -fingerprint) The hardware ID of the user (Executers automatically add this field).
### Validation Flow:
 1. The server reconstructs the hash using its internal secrets.
 2. If the signature matches, it checks if the key is expired or blacklisted.
 3. If reset_state is 1, the server binds the current fingerprint to the key.
 4. If the key is already bound, the fingerprint must match the stored HWID.
