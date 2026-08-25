const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smart-city-complaints');
    console.log('Connected to MongoDB');

    // 1. Super Admin
    await User.deleteOne({ email: 'admin@jansetu.city' });
    const adminUser = await User.create({
      name: 'Chief Administrative Commissioner',
      email: 'admin@jansetu.city',
      password: 'adminPassword123',
      role: 'admin',
      department: 'City Administration'
    });
    console.log('✅ Created Super Admin:', adminUser.email);

    // 2. Department Officers
    const deptAccounts = [
      { name: 'Sanitation Officer Sharma', email: 'sanitation@jansetu.city', department: 'Sanitation' },
      { name: 'Water Works Director Rao', email: 'water@jansetu.city', department: 'Water Supply' },
      { name: 'Roads Lead Patel', email: 'roads@jansetu.city', department: 'Public Works' },
      { name: 'Electricity Officer Verma', email: 'electric@jansetu.city', department: 'Electric Board' }
    ];

    for (const d of deptAccounts) {
      await User.deleteOne({ email: d.email });
      await User.create({
        name: d.name,
        email: d.email,
        password: 'adminPassword123',
        role: 'authority',
        department: d.department
      });
      console.log(`✅ Created Department Officer: ${d.email} (${d.department})`);
    }

    console.log('🎉 ALL ADMIN & AUTHORITY ACCOUNTS ARE READY!');
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin accounts:', err);
    process.exit(1);
  }
}

seedAdmin();
