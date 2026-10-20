'use strict';
const POLICY = 'subject-subscription-v1';
const SUBJECTS = Object.freeze([
  { id: 'farma', title: 'Фармакология', available: true },
  { id: 'biochem', title: 'Биохимия', available: true },
  { id: 'micro', title: 'Микробиология', available: true },
  { id: 'pathophys', title: 'Патологическая физиология', available: true },
  { id: 'biology', title: 'Биология', available: false },
]);
// Only server-owned documents confer access. A bundle writes one grant per subject,
// preserving the purchased subject list; future subjects are never unlocked implicitly.
function grantFor(doc, subject, at = Date.now()) {
  const g = doc && Object.hasOwn(doc, subject) && doc[subject];
  return g && g.revoked !== true && Number.isFinite(g.expiresAt) && g.expiresAt > at ? g : null;
}
function grantForUser(user, doc, subject, at = Date.now()) {
  if (user.contentAdmin === true && SUBJECTS.some(s => s.id === subject && s.available)) return { expiresAt: at + 15 * 60 * 1000, admin: true };
  return grantFor(doc, subject, at);
}
module.exports = { SUBJECTS, POLICY, grantFor, grantForUser };
