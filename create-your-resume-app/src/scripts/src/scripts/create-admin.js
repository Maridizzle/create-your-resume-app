// One-time setup script. Run locally or via Railway shell:
//   node src/scripts/create-admin.js <username> <password>
// There is no signup route in the app on purpose, this is the only way
// to create the admin account.

require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db/pool');

async function main() {
  const [, , username, password] = process.argv;
  if (!username || !password) {
    console.error('Usage: node create-admin.js <username> <password>');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Use a longer password, 12 characters minimum.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO admin_user (username, password_hash) VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = $2`,
    [username, hash]
  );
  console.log(`Admin user "${username}" created. Log in, then visit /api/auth/setup-2fa to enable 2FA.`);
  await pool.end();
}

main();
