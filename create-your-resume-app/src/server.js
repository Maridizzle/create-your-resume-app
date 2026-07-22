require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const pool = require('./db/pool');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const chatRoutes = require('./routes/chat');
const intakeRoutes = require('./routes/intake');
const resultsRoutes = require('./routes/results');
const outputRoutes = require('./routes/output');

const app = express();
app.set('trust proxy', 1); // Railway sits behind a proxy, needed for secure cookies

app.use(helmet());
app.use(express.json({ limit: '5mb' })); // resumes can be long

// Don't log request bodies, client PII lives there.
morgan.token('safe-url', (req) => req.originalUrl.split('?')[0]);
app.use(morgan(':method :safe-url :status :response-ms ms'));

app.use(
  session({
    store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 4 // 4 hour session, re-login after that
    }
  })
);

// Rate limit login attempts specifically, not the whole app.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { error: 'Too many login attempts, try again later' }
});
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/verify-2fa', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/intake', intakeRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/output', outputRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve the built React frontend (client/dist, via vite's outDir into src/public).
const path = require('path');
const clientDist = path.join(__dirname, 'public');
app.use(express.static(clientDist));

// SPA fallback: any non-API route serves index.html, React Router handles the rest.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
