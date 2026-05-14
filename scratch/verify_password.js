import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../apps/backend/.env') });

const UserSchema = new mongoose.Schema({
  email: String,
  studentId: String,
  passwordHash: String,
});

const User = mongoose.model('User', UserSchema);

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email: /test-student-unique/ });
    if (!user) {
      console.log('User not found');
      return;
    }
    
    const studentIdDigits = user.studentId.replace(/\D/g, '');
    const last6 = studentIdDigits.slice(-6);
    
    console.log('Found user:', user.email);
    console.log('Student ID:', user.studentId);
    console.log('Expected Password (last 6):', last6);
    
    const isValid = await bcrypt.compare(last6, user.passwordHash);
    console.log('Password matches last 6 digits?', isValid);
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}

verify();
