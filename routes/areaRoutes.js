const express = require('express')
const router = express.Router()
const {
  getAreas,
  createUnions,
  createVillages,
} = require('../controllers/areaController')

router.get('/', getAreas)
router.post('/unions', createUnions)
router.post('/villages', createVillages)

module.exports = router
