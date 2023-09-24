export const isEmpty = (value) => {
  switch (typeof value) {
    case 'undefined':
      return true
    case 'object':
      if (value == null) {
        return true
      }
      break
    case 'string':
      if (value === '') {
        return true
      }
      break
  }
  return false
}

export const isWkt = (str) => {
  // TODO: Better definition
  return str.match(/^[PLMG]+/)
}
