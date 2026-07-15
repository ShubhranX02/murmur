const admin = require('firebase-admin');
const { getApps } = require('firebase-admin/app');

let db = null;
let firebaseInitError = null;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID is missing.');
  }

  if (!getApps().length) {
    let credential;

    // Render can either expose a service-account JSON string as an environment
    // variable or mount it as a secret file and point GOOGLE_APPLICATION_CREDENTIALS
    // at that file.
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = admin.credential.applicationDefault();
    } else {
      throw new Error('Firebase Admin credentials are missing.');
    }

    admin.initializeApp({ credential, projectId });
  }

  db = admin.firestore();
  console.log(`Firebase connected to project ${projectId}.`);
} catch (error) {
  firebaseInitError = error;
  console.error('Firebase Admin initialization failed:', error.message);
}

module.exports = { admin, db, firebaseInitError };
