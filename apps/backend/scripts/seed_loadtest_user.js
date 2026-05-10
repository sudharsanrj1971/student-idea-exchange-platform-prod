import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../src/models/User.model.js';
import { connectDB, closeDB } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function seed() {
  try {
    await connectDB();
    
    const email = 'loadtest-user@ichange.app';
    const existing = await User.findOne({ email });
    
    if (existing) {
      console.log(`User ${email} already exists.`);
    } else {
      const user = new User({
        name: 'Load Test User',
        email,
        passwordHash: 'Password123',
        role: 'student',
        isActive: true
      });
      await user.save();
      console.log(`User ${email} created.`);
    }
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await closeDB();
  }
}

seed();
