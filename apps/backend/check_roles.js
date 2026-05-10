import mongoose from 'mongoose';
import 'dotenv/config';

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = mongoose.model('User', new mongoose.Schema({ email: String, role: String, name: String }));
    const counts = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
    console.log('User counts by role:', JSON.stringify(counts, null, 2));
    
    const admins = await User.find({ role: 'admin' }).lean();
    console.log('Admins:', JSON.stringify(admins, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

checkUsers();
