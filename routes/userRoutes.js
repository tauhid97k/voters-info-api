const express = require('express')
const router = express.Router()
const {
  createUsers,
  getUsers,
  getUser,
} = require('../controllers/userController')

router.get('/', getUsers)
router.get('/:id', getUser)
router.post('/', createUsers)

module.exports = router
