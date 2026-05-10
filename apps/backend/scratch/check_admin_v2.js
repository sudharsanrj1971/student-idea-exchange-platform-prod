import mongoose from 'mongoose';
import { User } from './apps/backend/src/models/User.model.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './apps/backend/.env' });

async function checkAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const admin = await User.findOne({ 
      $or: [
        { email: 'admin@studentideaexchange.com' },
        { email: 'sudharsanrj1971@gmail.com' }
      ]
    });
    
    if (admin) {
      console.log('Admin found:', {
        email: admin.email,
        role: admin.role,
        avatar: admin.avatar,
        studentId: admin.studentId
      });
    } else {
      console.log('Admin not found');
    }
    
    const allAdmins = await User.find({ role: 'admin' });
    console.log('All Admins:', allAdmins.map(a => a.email));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkAdmin();
