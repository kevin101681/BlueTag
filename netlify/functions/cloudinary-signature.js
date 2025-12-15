// Netlify Function to generate Cloudinary upload signature
// This keeps the API secret secure on the server side

const crypto = require('crypto');

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Check for Cloudinary credentials
    if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('Cloudinary not configured - missing environment variables');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Cloudinary not configured',
          message: 'CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in Netlify environment variables.',
        }),
      };
    }

    const { folder, timestamp, resourceType } = JSON.parse(event.body || '{}');
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    // Create signature parameters
    // Include all parameters that will be sent in the upload
    const params = {
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      folder: folder || 'bluetag/photos',
    };

    // Add transformation if it's an image or video
    if (resourceType === 'image' || resourceType === 'video') {
      params.transformation = 'f_auto,q_auto';
    }

    // Generate signature
    // Cloudinary signature is SHA1 hash of sorted parameters + secret
    const paramsString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    const signature = crypto
      .createHash('sha1')
      .update(paramsString + apiSecret)
      .digest('hex');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        signature,
        apiKey,
        timestamp: params.timestamp,
        folder: params.folder,
      }),
    };
  } catch (error) {
    console.error('Cloudinary signature error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to generate signature',
        message: error.message || 'Internal server error',
      }),
    };
  }
};

