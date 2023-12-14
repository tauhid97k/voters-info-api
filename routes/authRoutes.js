const express = require('express')
const router = express.Router()
const verifyAuth = require('../middlewares/authMiddleware')
const {
  register,
  login,
  refreshAuthToken,
  authAdmin,
  logout,
  resetPassword,
  verifyResetCode,
  updatePassword,
} = require('../controllers/authController')

// Public routes
router.post('/register', register)
router.post('/login', login)
router.post('/reset-password', resetPassword)
router.post('/verify-reset-code', verifyResetCode)
router.post('/update-password', updatePassword)
router.get('/refresh-token', refreshAuthToken)

// Protected Routes
router.use(verifyAuth)
router.get('/admin', authAdmin)
router.post('/logout', logout)

module.exports = router
