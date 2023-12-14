const prisma = require('../utils/prisma')
const asyncHandler = require('express-async-handler')
const {
  selectQueries,
  paginateWithAreaFields,
  paginateWithSorting,
} = require('../utils/transformData')
const { users } = require('../data/data')

/*
  @route    POST: /users
  @access   public
  @desc     Create a user
*/
const createUsers = asyncHandler(async (req, res, next) => {
  // Find random element in an array
  function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)]
  }

  // Generate users based on upozilla, union and village
  const [villages, unions, upozillas] = await prisma.$transaction([
    prisma.villages.findMany(),
    prisma.unions.findMany(),
    prisma.upozillas.findMany(),
  ])

  const generateUsers = users.map((user) => {
    const village = getRandomElement(villages)
    const union = unions.find((u) => u.id === village.union_id)
    const upozilla = upozillas.find((up) => up.id === union.upozilla_id)

    return {
      ...user,
      village_id: village.id,
      union_id: village.union_id,
      upozilla_id: upozilla.id,
    }
  })

  await prisma.users.createMany({
    data: generateUsers,
  })

  res.status(201).json({
    message: 'Users created successfully',
  })
})

/*
  @route    GET: /users
  @access   public
  @desc     Get all users
*/
const getUsers = asyncHandler(async (req, res, next) => {
  const selectedQueries = selectQueries(req.query, paginateWithAreaFields)
  const { page, take, skip, orderBy } = paginateWithSorting(selectedQueries)

  let { upozilla_id, union_id, village_id, gender } = selectedQueries

  upozilla_id = upozilla_id ? Number(upozilla_id) : null
  union_id = union_id ? Number(union_id) : null
  village_id = village_id ? Number(village_id) : null
  gender = gender ? gender.toUpperCase() : null

  let filterQuery = {}

  if (upozilla_id !== null) {
    filterQuery = {}
    filterQuery.upozilla_id = upozilla_id
  }
  if (union_id !== null) {
    filterQuery = {}
    filterQuery.union_id = union_id
  }
  if (village_id !== null) {
    filterQuery = {}
    filterQuery.village_id = village_id
  }

  const [users, total] = await prisma.$transaction([
    prisma.users.findMany({
      where: {
        AND: [filterQuery ? { ...filterQuery } : {}, gender ? { gender } : {}],
      },
      take,
      skip,
      orderBy,
    }),
    prisma.users.count({
      where: {
        AND: [filterQuery ? { ...filterQuery } : {}, gender ? { gender } : {}],
      },
    }),
  ])

  return res.json({
    data: users,
    meta: {
      page,
      limit: take,
      total,
    },
  })
})

module.exports = { createUsers, getUsers }
