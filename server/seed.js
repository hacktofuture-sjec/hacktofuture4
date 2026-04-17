const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smart-city-complaints');
        
        const deptUser = await User.findOne({ email: 'admin@city.gov' });
        if (!deptUser) {
            await User.create({
                name: 'Dept Manager (Water)',
                email: 'admin@city.gov',
                password: 'password123',
                role: 'department',
                department: 'Water Supply'
            });
            console.log('Department account created: admin@city.gov / password123');
        } else {
            console.log('Department account already exists.');
        }
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seed();
