// Shared "logged in" email - there are no accounts on this site, just the
// email a customer already types at checkout, remembered locally so they
// don't have to retype it on every visit (order lookup, member level, the
// header's account button). Same no-second-factor trade-off as the public
// leaderboard and member-level lookup: whoever knows the email can see it.
export const EMAIL_STORAGE_KEY = 'onebox-customer-email';

export function getStoredEmail(): string {
  return localStorage.getItem(EMAIL_STORAGE_KEY) ?? '';
}

export function setStoredEmail(email: string) {
  localStorage.setItem(EMAIL_STORAGE_KEY, email);
}

export function clearStoredEmail() {
  localStorage.removeItem(EMAIL_STORAGE_KEY);
}
