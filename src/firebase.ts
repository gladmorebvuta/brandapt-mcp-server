/**
 * Firebase Admin SDK initializer for BrandaptOS MCP Server.
 *
 * Authentication options (in priority order):
 * 1. BRANDAPT_SERVICE_ACCOUNT_PATH env var → path to downloaded service account JSON
 * 2. GOOGLE_APPLICATION_CREDENTIALS env var → standard Google ADC path
 * 3. Application Default Credentials (ADC) — works if already logged in via gcloud CLI
 *
 * To get a service account key:
 * Firebase Console → Project Settings → Service Accounts → Generate new private key
 * Save the JSON to a secure location on your machine (NOT inside a git repo).
 */

import * as admin from "firebase-admin";
import { readFileSync } from "fs";

const PROJECT_ID = process.env.BRANDAPT_PROJECT_ID || "brandaptos-v2";

let _db: admin.firestore.Firestore | null = null;

export function getDb(): admin.firestore.Firestore {
  if (_db) return _db;

  if (!admin.apps.length) {
    const serviceAccountPath = process.env.BRANDAPT_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: PROJECT_ID,
      });
    } else {
      // Falls back to GOOGLE_APPLICATION_CREDENTIALS or ADC
      admin.initializeApp({
        projectId: PROJECT_ID,
      });
    }
  }

  _db = admin.firestore();
  return _db;
}

export function getTimestamp(): admin.firestore.FieldValue {
  return admin.firestore.FieldValue.serverTimestamp();
}

export function getIncrement(n: number): admin.firestore.FieldValue {
  return admin.firestore.FieldValue.increment(n);
}
