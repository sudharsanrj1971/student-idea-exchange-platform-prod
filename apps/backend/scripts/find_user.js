
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../src/models/User.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function findUser() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: 'loadtest-user@ichange.app' });
  if (user) {
    console.log(user._id.toString());
  } else {
    const anyUser = await User.findOne();
    if (anyUser) {
      console.log(anyUser._id.toString());
    } else {
      console.log('NO_USER_FOUND');
    }
  }
  await mongoose.disconnect();
}

findUser();
