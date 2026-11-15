'use strict';
const POLICY = 'subject-subscription-v1';
const SUBJECTS = Object.freeze([
  { id: 'farma', title: 'Фармакология', available: true },
  { id: 'biochem', title: 'Биохимия', available: true },
  { id: 'micro', title: 'Микробиология', available: true },
  { id: 'pathophys', title: 'Патологическая физиология', available: true },
  { id: 'patan', title: 'Патологическая анатомия', available: true },
  { id: 'chemistry', title: 'Медицинская химия', available: true },
  { id: 'biology', title: 'Биология', available: false },
]);
// Only server-owned documents confer access. A bundle writes one grant per subject,
// preserving the purchased subject list; future subjects are never unlocked implicitly.
function grantFor(doc, subject, at = Date.now()) {
  const g = doc && Object.hasOwn(doc, subject) && doc[subject];
  return g && g.revoked !== true && Number.isFinite(g.expiresAt) && g.expiresAt > at ? g : null;
}
function grantForTopic(doc, subject, topic, at = Date.now()) {
  const full = grantFor(doc, subject, at);
  if (full) return full;
  if (!topic) return null;
  const entry = doc && Object.hasOwn(doc, subject) && doc[subject];
  const tg = entry && entry.topics && Object.hasOwn(entry.topics, topic) && entry.topics[topic];
  return tg && tg.revoked !== true && Number.isFinite(tg.expiresAt) && tg.expiresAt > at ? tg : null;
}
function topicGrantsFor(doc, subject, at = Date.now()) {
  const entry = doc && Object.hasOwn(doc, subject) && doc[subject];
  const topics = entry && entry.topics;
  if (!topics || typeof topics !== 'object') return {};
  const out = {};
  for (const [tid, tg] of Object.entries(topics)) {
    if (tg && tg.revoked !== true && Number.isFinite(tg.expiresAt) && tg.expiresAt > at) {
      out[tid] = { expiresAt: tg.expiresAt };
    }
  }
  return out;
}
function grantForUser(user, doc, subject, at = Date.now(), topic = null) {
  if (user.contentAdmin === true && SUBJECTS.some(s => s.id === subject && s.available)) return { expiresAt: at + 15 * 60 * 1000, admin: true };
  return topic ? grantForTopic(doc, subject, topic, at) : grantFor(doc, subject, at);
}
module.exports = { SUBJECTS, POLICY, grantFor, grantForTopic, topicGrantsFor, grantForUser };
