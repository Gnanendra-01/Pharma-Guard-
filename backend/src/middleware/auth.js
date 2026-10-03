const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_pharmaguard_jwt_key_for_demo_2026';

/**
 * Authentication middleware to verify JWT token from httpOnly cookie or Authorization header.
 * Attaches authenticated user object (id, name, email) to req.user.
 */
function authenticateToken(req, res, next) {
  // Check cookie first (primary auth mechanism in spec), fallback to Bearer header
  let token = req.cookies?.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists. Please log in again.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}

module.exports = {
  authenticateToken,
  JWT_SECRET
};
