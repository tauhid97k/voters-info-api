const prisma = require('../utils/prisma')
const asyncHandler = require('express-async-handler')
const {
  selectQueries,
  paginateWithAreaFields,
  paginateWithSorting,
} = require('../utils/transformData')
const covertEnNumberToBn = require('../utils/covertEnNumberToBn')
const { users } = require('../data/data')
const { userStatusValidator } = require('../validators/userValidator')

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

  let { upozilla_id, union_id, village_id, gender, status, search } =
    selectedQueries

  upozilla_id = upozilla_id ? Number(upozilla_id) : null
  union_id = union_id ? Number(union_id) : null
  village_id = village_id ? Number(village_id) : null
  gender = gender ? gender.toUpperCase() : null
  status = status ? status.toUpperCase() : null
  search = search ? covertEnNumberToBn(search) : null

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

  const [users, totalUsers] = await prisma.$transaction([
    prisma.users.findMany({
      where: {
        AND: [
          filterQuery ? { ...filterQuery } : {},
          gender ? { gender } : {},
          status ? { status } : {},
          search ? { nid: { contains: search } } : {},
        ],
      },
      take,
      skip,
      orderBy,
    }),
    prisma.users.findMany({
      where: {
        AND: [
          filterQuery ? { ...filterQuery } : {},
          gender ? { gender } : {},
          status ? { status } : {},
          search ? { nid: { contains: search } } : {},
        ],
      },
    }),
  ])

  if (!users.length || !totalUsers.length) {
    return res.json({
      message: 'No data found',
    })
  }

  // Status values
  const statusValues = ['RED', 'GREEN', 'YELLOW', 'WHITE']

  // Status counts and percentages
  const { statusCounts, statusPercentages } = statusValues.reduce(
    (result, status) => {
      // Count for each status
      result.statusCounts[status] = totalUsers.reduce(
        (sum, user) => (user.status === status ? sum + 1 : sum),
        0
      )

      // Percentage for each status
      result.statusPercentages[status] = Math.trunc(
        (result.statusCounts[status] / totalUsers.length) * 100
      )

      return result
    },
    { statusCounts: {}, statusPercentages: {} }
  )

  return res.json({
    data: users,
    stats: {
      statusCounts,
      statusPercentages,
    },
    meta: {
      page,
      limit: take,
      total: totalUsers.length,
    },
  })
})

/*
  @route    GET: /users/:id
  @access   public
  @desc     Get single user
*/
const getUser = asyncHandler(async (req, res, next) => {
  const id = Number(req.params.id)
  const findUser = await prisma.users.findUnique({
    where: {
      id,
    },
  })

  if (!findUser)
    return res.status(404).json({
      message: 'No user found',
    })

  res.json(findUser)
})

/*
  @route    GET: /users/:id/status
  @access   private
  @desc     Update user status
*/
const updateUserStatus = asyncHandler(async (req, res, next) => {
  const { status } = await userStatusValidator.validate(req.body, {
    abortEarly: false,
  })

  const selectedQueries = selectQueries(req.params, ['id'])
  const { id } = selectedQueries

  if (!id)
    return res.status(400).json({
      message: 'User id is required',
    })

  await prisma.$transaction(async (tx) => {
    const findUser = await tx.users.findUnique({
      where: {
        id: Number(id),
      },
    })

    if (!findUser)
      return res.status(404).json({
        message: 'No user found',
      })

    await tx.users.update({
      where: {
        id: findUser.id,
      },
      data: {
        status,
      },
    })

    res.json({
      message: 'Status updated',
    })
  })
})

module.exports = { createUsers, getUsers, getUser, updateUserStatus }
