import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: './apps/backend/.env' });

async function checkUsers() {
  try {
    console.log('Connecting to Atlas...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('Connected.');
    
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users.`);
    users.forEach(u => {
      console.log(`- ${u.email} | ID: ${u.studentId} | Role: ${u.role} | Avatar: ${u.avatar}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Connection failed:', err.message);
  }
}

checkUsers();
