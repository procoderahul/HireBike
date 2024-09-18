const express = require('express');
const router = express.Router();

// Admin Login
router.get('/login', (req, res) => {
  res.render('admin-login');
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'admin@gmail.com' && password === 'admin') {
    req.session.adminId = 'admin';
    res.redirect('/admin/admin-home');
  } else {
    res.redirect('/admin/login');
  }
});

// Admin Home Page
router.get('/admin-home', (req, res) => {
  if (req.session.adminId) {
    res.render('admin-home');
  } else {
    res.redirect('/admin/login');
  }
});

module.exports = router;
