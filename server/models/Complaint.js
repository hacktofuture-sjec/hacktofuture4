const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
  title: { type: String, required: true },
  text: { type: String, required: true },
  imageUrl: { type: String },
  location: { type: String },
  lat: { type: Number },
  lng: { type: Number },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String },
  severity: { type: String },
  keywords: [String],
  clusterId: { type: Number },
  priorityScore: { type: Number },
  priority: { type: String },
  department: { type: String },
  deadline: { type: Date },
  status: { 
    type: String, 
    enum: ['Pending', 'Assigned', 'In Progress', 'Resolved'], 
    default: 'Pending' 
  },
}, { timestamps: true });

module.exports = mongoose.model('Complaint', ComplaintSchema);
