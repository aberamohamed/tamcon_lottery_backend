export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    walletBalance: user.walletBalance,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };
}
