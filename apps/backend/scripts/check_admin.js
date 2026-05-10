import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../src/models/User.model.js';

dotenv.config({ path: path.resolve('apps/backend/.env') });

async function checkAdmins() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const admins = await User.find({ role: 'admin' }).lean();
    
    if (admins.length === 0) {
      console.log('❌ No admin accounts found in the database!');
      console.log('   Run: node scripts/update_test_creds.js to create one.');
    } else {
      console.log(`Found ${admins.length} admin account(s):\n`);
      admins.forEach((a, i) => {
        console.log(`[${i+1}] Name:      ${a.name}`);
        console.log(`     Email:     "${a.email}"`);
        console.log(`     isActive:  ${a.isActive}`);
        console.log(`     createdAt: ${a.createdAt}`);
        console.log('');
      });
      console.log('👉 Use the EXACT email above when signing in.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkAdmins();
