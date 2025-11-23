
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseConfig } from "./config";

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    const app = initializeApp({
      projectId: firebaseConfig.projectId,
    });
    return getSdks(app);
  }
  return getSdks(getApp());
}

export function getSdks(app: FirebaseApp) {
  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
  };
}
