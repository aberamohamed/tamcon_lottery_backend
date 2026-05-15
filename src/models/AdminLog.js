import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, collection: 'admin_logs' },
);

adminLogSchema.index({ createdAt: -1 });
adminLogSchema.index({ adminId: 1, createdAt: -1 });

export const AdminLog = mongoose.model('AdminLog', adminLogSchema);
