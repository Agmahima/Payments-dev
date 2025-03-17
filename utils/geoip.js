const axios = require('axios');

/**
 * Get region from IP address
 * @param {String} ip - IP address
 * @returns {Promise<String>} Region code (country code)
 */
exports.getRegion = async (ip) => {
  try {
    // Use a free IP geolocation service
    const response = await axios.get(`https://ipapi.co/${ip}/json/`);
    return response.data.country_code;
  } catch (error) {
    console.error('Error detecting region from IP:', error);
    return 'default';
  }
}; 