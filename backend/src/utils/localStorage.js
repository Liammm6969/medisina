import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ApiError from './ApiError.js';
import { StatusCodes } from 'http-status-codes';
import config from '#config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const getFileExtension = (file) => {
  if (file.originalname) {
    const ext = file.originalname.split('.').pop();
    if (ext && ext !== file.originalname) return ext;
  }
  const mimeExtMap = {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif'
  };
  return mimeExtMap[file.mimetype] || 'bin';
};

export async function uploadFileToLocal(file, patientId, publicId) {
  if (!file) throw new ApiError('No file provided', StatusCodes.BAD_REQUEST);

  const folderPath = path.join(UPLOAD_DIR, 'health_records', patientId);

  await fs.mkdir(folderPath, { recursive: true });

  const fileExtension = getFileExtension(file);
  const fileName = `${publicId}.${fileExtension}`;
  const filePath = path.join(folderPath, fileName);

  if (file.buffer) {
    await fs.writeFile(filePath, file.buffer);
  } else if (file.path) {
    await fs.copyFile(file.path, filePath);
  } else {
    throw new ApiError('Invalid file format', StatusCodes.BAD_REQUEST);
  }

  const baseUrl = config.BASE_URL;
  const publicUrl = `${baseUrl}/uploads/health_records/${patientId}/${fileName}`;

  return {
    secure_url: publicUrl,
    public_id: `health_records/${patientId}/${fileName}`,
    format: fileExtension,
    resource_type: file.mimetype?.startsWith('image/') ? 'image' : 'raw'
  };
}

export async function deleteLocalFile(publicId) {
  try {
    const filePath = path.join(UPLOAD_DIR, publicId);
    await fs.unlink(filePath);
    return { result: 'ok' };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { result: 'not found' };
    }
    throw error;
  }
}

export { uploadFileToLocal as uploadFileToCloudinary };
