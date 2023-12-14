const express = require('express')
const router = express.Router()
const { createUsers, getUsers } = require('../controllers/userController')

router.get('/', getUsers)
router.post('/', createUsers)

module.exports = router
