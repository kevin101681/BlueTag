// Cloudinary upload service
// Handles direct client-side uploads to Cloudinary

interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  format: string;
  resource_type: string;
  bytes: number;
  width?: number;
  height?: number;
}

interface CloudinaryUploadResult {
  id: string;
  name: string;
  url: string;
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
}

/**
 * Upload a file to Cloudinary
 * @param file - The file to upload
 * @param folder - Optional folder path in Cloudinary (e.g., 'bluetag/photos')
 * @returns Promise with upload result
 */
export async function uploadToCloudinary(
  file: File,
  folder: string = 'bluetag/photos'
): Promise<CloudinaryUploadResult> {
  // Determine resource type first (needed for signature)
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const resourceType = isVideo ? 'video' : isImage ? 'image' : 'raw';

  // Get upload signature from Netlify function
  const signatureResponse = await fetch('/.netlify/functions/cloudinary-signature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      folder,
      timestamp: Math.floor(Date.now() / 1000),
      resourceType,
    }),
  });

  if (!signatureResponse.ok) {
    const error = await signatureResponse.json();
    throw new Error(error.message || 'Failed to get upload signature');
  }

  const { signature, apiKey, timestamp, folder: signedFolder } = await signatureResponse.json();

  // Prepare form data for Cloudinary upload
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', signedFolder);

  // Add transformation for images/videos
  if (resourceType === 'image' || resourceType === 'video') {
    formData.append('transformation', 'f_auto,q_auto');
  }

  // Upload to Cloudinary
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  
  if (!cloudName || cloudName === 'your-cloud-name') {
    throw new Error('Cloudinary not configured. Please set VITE_CLOUDINARY_CLOUD_NAME in your environment variables.');
  }
  
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    throw new Error(error.error?.message || 'Upload failed');
  }

  const result: CloudinaryUploadResponse = await uploadResponse.json();

  // Determine attachment type
  let attachmentType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' = 'DOCUMENT';
  if (result.resource_type === 'image') {
    attachmentType = 'IMAGE';
  } else if (result.resource_type === 'video') {
    attachmentType = 'VIDEO';
  }

  return {
    id: result.public_id,
    name: file.name,
    url: result.secure_url,
    type: attachmentType,
  };
}

/**
 * Upload multiple files to Cloudinary
 * @param files - Array of files to upload
 * @param folder - Optional folder path in Cloudinary
 * @returns Promise with array of upload results
 */
export async function uploadMultipleToCloudinary(
  files: File[],
  folder?: string
): Promise<CloudinaryUploadResult[]> {
  const uploadPromises = files.map(file => uploadToCloudinary(file, folder));
  return Promise.all(uploadPromises);
}




