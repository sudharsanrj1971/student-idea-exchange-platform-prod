import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../src/models/User.model.js';

dotenv.config({ path: path.resolve('.env') });

async function update() {
  const email = 'testuser@ichange.com';
  const name = 'BUBU';
  const password = '@bubududu13362056';

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    let user = await User.findOne({ email });
    if (!user) {
        console.log('User not found, creating fresh...');
        user = new User({ email, name, passwordHash: password, role: 'admin' });
    } else {
        user.name = name;
        user.passwordHash = password; // pre-save hook will hash it
        user.role = 'admin';
    }

    await user.save();
    console.log(`✅ User ${email} updated successfully!`);
    console.log(`Name: ${name}`);
    console.log(`Password: ${password}`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

update();
