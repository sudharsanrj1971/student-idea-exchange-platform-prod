import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

import { User } from './src/models/User.model.js';
import { connectDB } from './src/config/db.js';

async function checkAdmin() {
  await connectDB();
  const adminEmail = 'sudharsanrj1971@gmail.com';
  const user = await User.findOne({ email: adminEmail });
  if (user) {
    console.log('Admin user found:', {
      email: user.email,
      role: user.role,
      studentId: user.studentId,
      isActive: user.isActive
    });
  } else {
    console.log('Admin user NOT found with email:', adminEmail);
    const allAdmins = await User.find({ role: 'admin' });
    console.log('All admins in DB:', allAdmins.map(u => u.email));
  }
  process.exit(0);
}

checkAdmin();
