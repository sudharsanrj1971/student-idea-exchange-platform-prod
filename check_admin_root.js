import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: './apps/backend/.env' });

// We need to use the actual model file
import { User } from './apps/backend/src/models/User.model.js';

async function checkAdmin() {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');
    
    const users = await User.find({ 
      $or: [
        { email: /admin/i },
        { studentId: /admin/i },
        { name: /admin/i }
      ]
    });
    
    if (users.length > 0) {
      users.forEach(user => {
        console.log('User found:', {
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          studentId: user.studentId,
          auth_provider: user.auth_provider
        });
      });
    } else {
      console.log('No admin users found');
    }

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

checkAdmin();
