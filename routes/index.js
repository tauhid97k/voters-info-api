const express = require('express')
const router = express.Router()

// Routes
router.use('/auth', require('./authRoutes'))
router.use('/users', require('./userRoutes'))
router.use('/areas', require('./areaRoutes'))

module.exports = router
