const prisma = require('../utils/prisma')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const isEmpty = require('lodash/isEmpty')
const asyncHandler = require('express-async-handler')
const createError = require('../utils/errorHandler')
const { sendPasswordResetCode } = require('../utils/mailHandlers')
const registerValidator = require('../validators/registerValidator')
const loginValidator = require('../validators/loginValidator')
const {
  passwordResetValidator,
  resetCodeVerifyValidator,
  passwordUpdateValidator,
} = require('../validators/verificationValidators')

/*
  @route    POST: /register
  @access   public
  @desc     New admin registration
*/
const register = asyncHandler(async (req, res, next) => {
  const data = await registerValidator.validate(req.body, { abortEarly: false })

  // Encrypt password
  data.password = await bcrypt.hash(data.password, 12)

  // Create new admin
  await prisma.$transaction(async (tx) => {
    const admin = await tx.admins.create({ data })

    // Login the admin
    // Generate JWT Access Token
    const accessToken = jwt.sign(
      {
        admin: {
          email: admin.email,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '1d' }
    )

    // Generate JWT Refresh Token
    const refreshToken = jwt.sign(
      {
        admin: {
          email: admin.email,
        },
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    )

    // JWT expiry
    const jwtExpireTime = jwt.decode(refreshToken, { complete: true }).payload
      .exp

    // Save refresh token to database with device model (if available)
    const deviceBrand = isEmpty(req.device.device.brand)
      ? ''
      : req.device.device.brand
    const deviceModel = isEmpty(req.device.device.model)
      ? ''
      : req.device.device.model
    const deviceWithModel =
      deviceBrand && deviceModel ? `${deviceBrand} ${deviceModel}` : 'unknown'

    await tx.personal_tokens.create({
      data: {
        admin_id: admin.id,
        refresh_token: refreshToken,
        expires_at: jwtExpireTime,
        user_device: deviceWithModel,
      },
    })

    // Create secure cookie with refresh token
    res.cookie('express_jwt', refreshToken, {
      httpOnly: true, // Accessible only by server
      secure: false, // https
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    })

    res.status(201).json({
      message: 'Account created',
      accessToken,
    })
  })
})

/*
  @route    POST: /login
  @access   public
  @desc     User login
*/
const login = asyncHandler(async (req, res, next) => {
  // Check if any old cookie exist (delete it)
  const cookies = req.cookies
  if (cookies?.express_jwt) {
    res.clearCookie('express_jwt', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    })
  }

  const { email, password } = await loginValidator.validate(req.body, {
    abortEarly: false,
  })

  await prisma.$transaction(async (tx) => {
    const admin = await tx.admins.findUnique({
      where: {
        email,
      },
    })

    // Validate Password
    const isPasswordValid = await bcrypt.compare(password, admin.password)

    // Check user
    if (email === admin.email && isPasswordValid) {
      // Generate JWT Access Token
      const accessToken = jwt.sign(
        {
          admin: {
            email: admin.email,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '1d' }
      )

      // Generate JWT Refresh Token
      const refreshToken = jwt.sign(
        {
          admin: {
            email: admin.email,
          },
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      )

      // JWT expiry
      const jwtExpireTime = jwt.decode(refreshToken, { complete: true }).payload
        .exp

      // Save refresh token to database with device model (if available)
      const deviceBrand = isEmpty(req.device.device.brand)
        ? ''
        : req.device.device.brand
      const deviceModel = isEmpty(req.device.device.model)
        ? ''
        : req.device.device.model
      const deviceWithModel =
        deviceBrand && deviceModel ? `${deviceBrand} ${deviceModel}` : 'unknown'

      await tx.personal_tokens.create({
        data: {
          admin_id: admin.id,
          refresh_token: refreshToken,
          expires_at: jwtExpireTime,
          user_device: deviceWithModel,
        },
      })

      // Create secure cookie with refresh token
      res.cookie('express_jwt', refreshToken, {
        httpOnly: true, // Accessible only by server
        secure: false, // https
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })

      res.json({
        accessToken,
      })
    } else {
      throw new createError(401, 'Invalid email or password')
    }
  })
})

/*
  @route    GET: /refresh
  @access   public
  @desc     Generate access token (because access token has expired)
*/
const refreshAuthToken = asyncHandler(async (req, res, next) => {
  const cookies = req.cookies
  if (!cookies?.express_jwt)
    return res.status(401).json({ message: 'Unauthorized' })

  const refreshToken = cookies.express_jwt

  // Check if tokens exist
  const tokens = await prisma.personal_tokens.findMany({
    where: {
      refresh_token: refreshToken,
    },
  })

  // Delete current cookie
  res.clearCookie('express_jwt', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
  })

  // Possible reuse of refresh token detection
  if (!tokens.length) {
    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      asyncHandler(async (error, decoded) => {
        if (error) return res.status(403).json({ message: 'Forbidden' })

        // Check if user exist
        const possibleCompromisedAdmin = await prisma.admins.findUnique({
          where: {
            email: decoded.admin.email,
          },
        })

        // If user exist, delete all related tokens
        if (possibleCompromisedAdmin) {
          await prisma.personal_tokens.deleteMany({
            where: {
              admin_id: possibleCompromisedAdmin.id,
            },
          })
        }
      })
    )

    // Don't let go further
    return res.status(403).json({ message: 'Forbidden' })
  }

  // If token exist, verify the token
  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    asyncHandler(async (error, decoded) => {
      if (error) return res.status(403).json({ message: 'Forbidden' })

      // Get current admin
      const admin = await prisma.admins.findUnique({
        where: {
          email: decoded.admin.email,
        },
      })

      if (!admin) return res.status(401).json({ message: 'Unauthorized' })

      // New JWT Access Token
      const newAccessToken = jwt.sign(
        {
          admin: {
            email: admin.email,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: '2m' }
      )

      // New JWT Refresh Token
      const newRefreshToken = jwt.sign(
        {
          admin: {
            email: admin.email,
          },
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      )

      // JWT expiry
      const jwtExpireTime = jwt.decode(newRefreshToken, { complete: true })
        .payload.exp

      // Save and update refresh token in database
      await prisma.personal_tokens.updateMany({
        where: {
          refresh_token: refreshToken,
        },
        data: {
          refresh_token: newRefreshToken,
          expires_at: jwtExpireTime,
        },
      })

      // Create new secure cookie with refresh token
      res.cookie('express_jwt', newRefreshToken, {
        httpOnly: true, // Accessible only by server
        secure: false, // https
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })

      res.json({ accessToken: newAccessToken })
    })
  )
})

/*
  @route    GET: /admin
  @access   private
  @desc     Auth user
*/
const authAdmin = asyncHandler(async (req, res, next) => {
  res.json(req.admin)
})

/*
  @route    POST: /logout
  @access   private
  @desc     Logout auth user
*/
const logout = asyncHandler(async (req, res, next) => {
  await prisma.$transaction(async (tx) => {
    const cookies = req.cookies
    if (!cookies?.express_jwt)
      return res.status(401).json({ message: 'Unauthorized' })

    const refreshToken = cookies.express_jwt

    // Delete refresh tokens from database
    await tx.personal_tokens.deleteMany({
      where: {
        refresh_token: refreshToken,
      },
    })

    // Clear cookie
    res.clearCookie('express_jwt', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    })

    res.json({
      message: 'You are now logged out',
    })
  })
})

/*
  @route    POST: /reset-password
  @access   public
  @desc     Request for resetting password
*/
const resetPassword = asyncHandler(async (req, res, next) => {
  const data = await passwordResetValidator.validate(req.body, {
    abortEarly: false,
  })

  // Send a password reset code to email
  const resetCode = Math.floor(10000000 + Math.random() * 90000000)
  await sendPasswordResetCode(data.email, resetCode)

  res.json({
    message: 'A verification code has been sent to your email',
  })
})

/*
  @route    POST: /verify-reset-code
  @access   public
  @desc     Verify password reset code
*/
const verifyResetCode = asyncHandler(async (req, res, next) => {
  const { token, code } = await resetCodeVerifyValidator.validate(req.body, {
    abortEarly: false,
  })

  const checkVerifyCode = await prisma.verification_tokens.findFirst({
    where: {
      AND: [{ token }, { code }],
    },
  })

  if (!checkVerifyCode) {
    return res.json({ message: 'Invalid Code' })
  }

  // Generate A Token (With admin id)
  const passwordResetToken = jwt.sign(
    {
      admin: {
        id: checkVerifyCode.admin_id,
      },
    },
    process.env.RESET_TOKEN_SECRET,
    { expiresIn: '5m' }
  )

  res.json({
    message: 'Verification successful',
    token: passwordResetToken,
  })
})

/*
  @route    POST: /update-password
  @access   public
  @desc     Update password
*/
const updatePassword = asyncHandler(async (req, res, next) => {
  const data = await passwordUpdateValidator.validate(req.body, {
    abortEarly: false,
  })

  // Check Reset Token Header
  const resetTokenHeader =
    req.headers.authorization || req.headers.Authorization

  if (!resetTokenHeader?.startsWith('Bearer ')) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const token = resetTokenHeader.split(' ')[1]

  jwt.verify(token, process.env.RESET_TOKEN_SECRET, async (error, decoded) => {
    if (error) return res.status(403).json({ message: 'Forbidden' })

    await prisma.$transaction(async (tx) => {
      const admin = await tx.admins.findUnique({
        where: {
          id: decoded.admin.id,
        },
      })

      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' })
      }

      // Delete admin's previous login tokens
      await tx.personal_tokens.deleteMany({
        where: {
          admin_id: admin.id,
        },
      })

      // Encrypt password
      data.password = await bcrypt.hash(data.password, 12)

      // Update user password
      await tx.admins.update({
        where: {
          email: admin.email,
        },
        data: {
          password: data.password,
          verification_tokens: {
            deleteMany: {
              admin_id: admin.id,
            },
          },
        },
      })
    })

    res.json({
      message: 'Password has been updated',
    })
  })
})

module.exports = {
  register,
  login,
  refreshAuthToken,
  authAdmin,
  logout,
  resetPassword,
  verifyResetCode,
  updatePassword,
}
