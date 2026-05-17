// Split a full name into first and last name so Chapa API accepts it.
export function splitFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: 'Customer', lastName: 'User' };
  }
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: 'Customer', lastName: 'User' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}
