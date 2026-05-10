
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const secret = process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production-64chars-minimum';
const payload = {
  id: '6630f9a2e3a5a4a5a5a5a5a5', // Dummy ID
  role: 'admin'
};

const token = jwt.sign(payload, secret, { expiresIn: '1h' });
console.log(token);
