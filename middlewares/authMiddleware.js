const jwt = require('jsonwebtoken')
const prisma = require('../utils/prisma')
const dayjs = require('dayjs')

const verifyAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (error, decoded) => {
    if (error) return res.status(403).json({ message: 'Forbidden' })
    const admin = await prisma.admins.findUnique({
      where: {
        email: decoded.admin.email,
      },
    })

    // Check if user exist in db
    if (!admin) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    // Format Admin Data
    const formattedAdmin = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      created_at: admin.created_at,
    }

    // Format dates
    formattedAdmin.created_at = dayjs(admin.created_at).format('DD MMM YYYY')

    req.admin = formattedAdmin

    next()
  })
}

module.exports = verifyAuth
