const express = require('express')
const router = express.Router()
const {
  createUsers,
  getUsers,
  getUser,
  updateUserStatus,
} = require('../controllers/userController')

router.get('/', getUsers)
router.get('/:id', getUser)
router.post('/', createUsers)
router.patch('/:id/status', updateUserStatus)

module.exports = router
