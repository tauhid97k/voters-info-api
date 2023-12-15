const covertEnNumberToBn = (englishNumber) => {
  const bengaliNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']

  return englishNumber
    .split('')
    .map((char) => (/\d/.test(char) ? bengaliNumerals[parseInt(char)] : char))
    .join('')
}

module.exports = covertEnNumberToBn
