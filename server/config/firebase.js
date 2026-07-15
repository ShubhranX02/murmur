const admin = require('firebase-admin');
const { getApps } = require('firebase-admin/app');

let db = null;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-project';
  
  if (!getApps().length) {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId
      });
    } catch (e) {
      admin.initializeApp({
        projectId: projectId
      });
    }
  }
  db = admin.firestore();
} catch (error) {
  console.log('Firebase init failed (expected if .env is missing). Running without DB.');
}

module.exports = { admin, db };
