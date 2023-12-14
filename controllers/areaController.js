const prisma = require('../utils/prisma')
const asyncHandler = require('express-async-handler')
const { selectQueries } = require('../utils/transformData')
const { unions, villages } = require('../data/data')

/*
  @route    POST: /areas/unions
  @access   public
  @desc     Create unions
*/
const createUnions = asyncHandler(async (req, res, next) => {
  await prisma.unions.createMany({
    data: unions,
  })

  res.status(201).json({
    message: 'Unions are created successfully',
  })
})

/*
  @route    POST: /areas/villages
  @access   public
  @desc     Create villages
*/
const createVillages = asyncHandler(async (req, res, next) => {
  await prisma.villages.createMany({
    data: villages,
  })

  res.status(201).json({
    message: 'Villages are created successfully',
  })
})

/*
  @route    GET: /areas
  @access   public
  @desc     Get all areas (with filters)
*/
const getAreas = asyncHandler(async (req, res, next) => {
  const selectedQueries = selectQueries(req.query, ['id'])

  const { id } = selectedQueries

  if (!id)
    return res.status(400).json({
      message: 'Upozilla id is required',
    })

  const areas = await prisma.unions.findMany({
    where: {
      upozilla_id: Number(id),
    },
    include: {
      villages: true,
    },
  })

  res.json(areas)
})

module.exports = {
  getAreas,
  createUnions,
  createVillages,
}
