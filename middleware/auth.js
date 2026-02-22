// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = async (req, res, next) => {
  try {

    // DEV MODE
    if (process.env.NODE_ENV === 'development') {
      const userId =
        req.body.userId ||
        req.query.userId;

      if (userId) {
        req.userId = userId;
        return next();
      }
    }

    // PROD MODE
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();

  } catch (error) {
    return res.status(401).json({ message: "Token invalide" });
  }
};