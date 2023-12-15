const covertEnNumberToBn = (inputNumber) => {
  const bengaliNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']

  let convertedNumber = inputNumber
    .split('')
    .map((char) => (/\d/.test(char) ? bengaliNumerals[parseInt(char)] : char))
    .join('')

  // Trim spaces
  convertedNumber = convertedNumber.replace(/\s/g, '')
  return convertedNumber
}

module.exports = covertEnNumberToBn
