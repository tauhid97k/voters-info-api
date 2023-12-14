const yup = require('yup')
const prisma = require('../utils/prisma')

const registerValidator = yup.object({
  name: yup.string().required('Name is required'),
  email: yup
    .string()
    .required('Email is required')
    .email('Email is invalid')
    .test('unique', 'Email already exist', async (value) => {
      const email = await prisma.admins.findUnique({
        where: {
          email: value,
        },
      })

      if (email) return false
      else return true
    }),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters'),
})

module.exports = registerValidator
