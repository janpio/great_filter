function isLiveMode() {
  const value = process.env.GF_USE_LIVE;
  return typeof value === 'string' && ['1', 'true', 'yes'].includes(value.toLowerCase());
}

module.exports = {
  isLiveMode,
};
