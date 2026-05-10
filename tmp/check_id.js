import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../apps/backend/.env') });

console.log('Backend GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
