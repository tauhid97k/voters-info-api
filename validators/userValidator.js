const yup = require('yup')

const userStatusValidator = yup.object({
  status: yup
    .string()
    .required('Status is required')
    .oneOf(['RED', 'YELLOW', 'GREEN', 'WHITE']),
})

module.exports = { userStatusValidator }
