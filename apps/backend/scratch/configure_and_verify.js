import mongoose from 'mongoose';
import { User } from '../src/models/User.model.js';
import { Config } from '../src/models/Config.model.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: './apps/backend/.env' });

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log('Connecting to:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected successfully!');

    // 1. Check & set maintenance_mode
    let maintenanceConfig = await Config.findOne({ key: 'maintenance_mode' });
    console.log('Current maintenance_mode config:', maintenanceConfig);

    if (maintenanceConfig) {
      maintenanceConfig.value = false;
      await maintenanceConfig.save();
      console.log('Updated maintenance_mode to false');
    } else {
      maintenanceConfig = await Config.create({
        key: 'maintenance_mode',
        value: false,
        description: 'Global maintenance mode toggle'
      });
      console.log('Created maintenance_mode config set to false');
    }

    // Double check the value
    const checkConfig = await Config.findOne({ key: 'maintenance_mode' });
    console.log('Verified maintenance_mode config in DB:', checkConfig);

    // 2. Fetch all admin users
    const admins = await User.find({ role: 'admin' });
    console.log('Admin Users count:', admins.length);
    admins.forEach(admin => {
      console.log('Admin Details:', {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        name: admin.name
      });
    });

    // 3. Let's print first few regular users as well just in case
    const users = await User.find({ role: 'student' }).limit(3);
    console.log('Sample Students:', users.map(u => ({ email: u.email, name: u.name, isActive: u.isActive })));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error running script:', err);
  }
}

run();
