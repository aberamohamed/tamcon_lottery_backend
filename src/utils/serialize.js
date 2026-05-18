// Format a Mongoose user document to a clean JSON object for safe delivery to clients (stripping out sensitive tokens/passwords).
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
