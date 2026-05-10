
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { User } from '../src/models/User.model.js';
import { UserProfile } from '../src/models/UserProfile.model.js';
import { connectDB, closeDB } from '../src/config/db.js';
import { resolveProfileIdentity } from '../src/services/profile.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  try {
    console.log('Connecting to DB...');
    await connectDB();
    console.log('Connected.');

    const adminEmail = process.env.ADMIN_EMAIL || 'sudharsanrj1971@gmail.com';
    const admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      console.error(`❌ Admin user not found: ${adminEmail}`);
    } else {
      console.log(`✅ Admin user found: ${admin.email} (ID: ${admin._id})`);
      console.log(`   Current admin.profilePic: ${admin.profilePic}`);

      const profile = await UserProfile.findOne({ userId: admin._id });
      if (profile) {
        console.log(`✅ Admin UserProfile found.`);
        console.log(`   profilePic: ${profile.profilePic}`);
        console.log(`   profileSource: ${profile.profileSource}`);
        
        // Check for "ghost" fields that might have been created by the bug
        const rawProfile = await UserProfile.findOne({ userId: admin._id }).lean();
        if (rawProfile.user_id || rawProfile.google_image_url || rawProfile.resolved_image_url) {
          console.warn(`⚠️  Found deprecated/buggy fields in UserProfile:`, {
            user_id: rawProfile.user_id,
            google_image_url: rawProfile.google_image_url,
            resolved_image_url: rawProfile.resolved_image_url
          });
        } else {
          console.log(`✅ No deprecated fields found in UserProfile.`);
        }
      } else {
        console.log(`❌ Admin UserProfile NOT found.`);
      }

      console.log('\nResolving profile identity...');
      const resolved = await resolveProfileIdentity(admin._id, true);
      console.log('Resolved Identity:', JSON.stringify(resolved, null, 2));
    }

    await closeDB();
    console.log('\nDone.');
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

run();
