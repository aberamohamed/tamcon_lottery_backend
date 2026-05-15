import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 4000 },
    type: { type: String, default: 'general', index: true },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: 'notifications' },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
