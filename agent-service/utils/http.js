const axios = require("axios");

async function safeGet(url) {
  try {
    const response = await axios.get(url, {
      timeout: 5000
    });

    return {
      ok: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      ok: false,
      status: error.response?.status || 500,
      error: error.message,
      data: error.response?.data || null
    };
  }
}

async function safePost(url, body = {}) {
  try {
    const response = await axios.post(url, body, {
      timeout: 5000
    });

    return {
      ok: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      ok: false,
      status: error.response?.status || 500,
      error: error.message,
      data: error.response?.data || null
    };
  }
}

module.exports = {
  safeGet,
  safePost
};