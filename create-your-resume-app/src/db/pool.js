const { Pool } = require('pg');

// Railway injects DATABASE_URL automatically once a Postgres service is
// attached to this project. SSL is required in production on Railway,
// optional locally.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

module.exports = pool;
