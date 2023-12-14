const yup = require('yup')
const prisma = require('../utils/prisma')

const passwordResetValidator = yup.object({
  email: yup
    .string()
    .required('Email is required')
    .email('Email is invalid')
    .test('exist', 'Email does not exist', async (value) => {
      const email = await prisma.admins.findUnique({
        where: {
          email: value,
        },
      })

      if (email) return true
      else return false
    }),
})

const resetCodeVerifyValidator = yup.object({
  code: yup
    .number()
    .required('Code is required')
    .typeError('Code Must be a number'),
  token: yup.string().required('Token is required'),
})

const passwordUpdateValidator = yup.object({
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters'),
})

module.exports = {
  passwordResetValidator,
  resetCodeVerifyValidator,
  passwordUpdateValidator,
}
