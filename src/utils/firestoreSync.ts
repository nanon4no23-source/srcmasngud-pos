import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc,
  deleteDoc, 
  collection, 
  onSnapshot,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { ItemBarang, Pelanggan, Transaksi, PesananOnline } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse existing Firebase app instances if available
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

/**
 * Custom error handler for Firestore permission or quota errors conforming to integration guidelines.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Write or Update an ItemBarang document in cloud Firestore
 */
export const syncBarangToCloud = async (uid: string, item: ItemBarang) => {
  const path = `users/${uid}/barang/${item.id}`;
  try {
    const docRef = doc(db, `users/${uid}/barang`, item.id);
    await setDoc(docRef, item);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

/**
 * Delete ItemBarang document from cloud Firestore
 */
export const deleteBarangFromCloud = async (uid: string, itemId: string) => {
  const path = `users/${uid}/barang/${itemId}`;
  try {
    const docRef = doc(db, `users/${uid}/barang`, itemId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

/**
 * Write or Update a Pelanggan (Member) in cloud Firestore
 */
export const syncPelangganToCloud = async (uid: string, p: Pelanggan) => {
  const path = `users/${uid}/pelanggan/${p.id}`;
  try {
    const docRef = doc(db, `users/${uid}/pelanggan`, p.id);
    await setDoc(docRef, p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

/**
 * Delete a Pelanggan (Member) from cloud Firestore
 */
export const deletePelangganFromCloud = async (uid: string, pId: string) => {
  const path = `users/${uid}/pelanggan/${pId}`;
  try {
    const docRef = doc(db, `users/${uid}/pelanggan`, pId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

/**
 * Write or Update a Transaksi document in cloud Firestore
 */
export const syncTransaksiToCloud = async (uid: string, tx: Transaksi) => {
  const path = `users/${uid}/transaksi/${tx.id}`;
  try {
    const docRef = doc(db, `users/${uid}/transaksi`, tx.id);
    await setDoc(docRef, tx);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

/**
 * Delete a Transaksi document from cloud Firestore
 */
export const deleteTransaksiFromCloud = async (uid: string, txId: string) => {
  const path = `users/${uid}/transaksi/${txId}`;
  try {
    const docRef = doc(db, `users/${uid}/transaksi`, txId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

/**
 * Write or Update a PesananOnline document in cloud Firestore
 */
export const syncPesananOnlineToCloud = async (uid: string, order: PesananOnline) => {
  const path = `users/${uid}/pesanan_online/${order.id}`;
  try {
    const docRef = doc(db, `users/${uid}/pesanan_online`, order.id);
    await setDoc(docRef, order);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

/**
 * Delete a PesananOnline document from cloud Firestore
 */
export const deletePesananOnlineFromCloud = async (uid: string, orderId: string) => {
  const path = `users/${uid}/pesanan_online/${orderId}`;
  try {
    const docRef = doc(db, `users/${uid}/pesanan_online`, orderId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

/**
 * Bulk upload initial local database to cloud (for first startup)
 */
export const initializeCloudDatabase = async (
  uid: string, 
  payload: { barang: ItemBarang[]; pelanggan: Pelanggan[]; transaksi: Transaksi[] }
) => {
  const path = `users/${uid} (bulk init batch)`;
  try {
    // Group all document write operations
    const operations: { ref: any; data: any }[] = [];

    payload.barang.forEach((item) => {
      const ref = doc(db, `users/${uid}/barang`, item.id);
      operations.push({ ref, data: item });
    });

    payload.pelanggan.forEach((p) => {
      const ref = doc(db, `users/${uid}/pelanggan`, p.id);
      operations.push({ ref, data: p });
    });

    payload.transaksi.forEach((tx) => {
      const ref = doc(db, `users/${uid}/transaksi`, tx.id);
      operations.push({ ref, data: tx });
    });

    // Firestore batch writes are limited to 500 documents per batch.
    // We execute batches of up to 400 operations to be completely safe.
    const BATCH_LIMIT = 400;
    for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
      const chunk = operations.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);
      chunk.forEach((op) => {
        batch.set(op.ref, op.data);
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

/**
 * Sets up 3 dynamic real-time listeners for barang, pelanggan, and transaksi collections
 * Returns cleanup unsubscribe functions combined.
 */
export const listenToRealtimeCloud = (
  uid: string,
  callbacks: {
    onBarang: (items: ItemBarang[]) => void;
    onPelanggan: (members: Pelanggan[]) => void;
    onTransaksi: (trx: Transaksi[]) => void;
    onPesananOnline?: (orders: PesananOnline[]) => void;
    onSettings?: (settings: { config: any; minBelanja?: number; nilaiPoin?: number }) => void;
    onDeletedIds?: (deletedIds: { barang: string[]; pelanggan: string[]; transaksi: string[] }) => void;
  }
) => {
  const unsubBarang = onSnapshot(
    collection(db, `users/${uid}/barang`),
    (snapshot) => {
      const updatedList: ItemBarang[] = [];
      snapshot.forEach((docSnap) => {
        updatedList.push(docSnap.data() as ItemBarang);
      });
      callbacks.onBarang(updatedList);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}/barang`);
    }
  );

  const unsubPelanggan = onSnapshot(
    collection(db, `users/${uid}/pelanggan`),
    (snapshot) => {
      const updatedList: Pelanggan[] = [];
      snapshot.forEach((docSnap) => {
        updatedList.push(docSnap.data() as Pelanggan);
      });
      callbacks.onPelanggan(updatedList);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}/pelanggan`);
    }
  );

  const unsubTransaksi = onSnapshot(
    collection(db, `users/${uid}/transaksi`),
    (snapshot) => {
      const updatedList: Transaksi[] = [];
      snapshot.forEach((docSnap) => {
        updatedList.push(docSnap.data() as Transaksi);
      });
      callbacks.onTransaksi(updatedList);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${uid}/transaksi`);
    }
  );

  const unsubPesananOnline = callbacks.onPesananOnline
    ? onSnapshot(
        collection(db, `users/${uid}/pesanan_online`),
        (snapshot) => {
          const updatedList: PesananOnline[] = [];
          snapshot.forEach((docSnap) => {
            updatedList.push(docSnap.data() as PesananOnline);
          });
          callbacks.onPesananOnline!(updatedList);
        },
        (error) => {
          console.warn("Soft pesanan_online listen warning:", error);
        }
      )
    : () => {};

  const unsubDeletedIds = callbacks.onDeletedIds
    ? onSnapshot(
        doc(db, `users/${uid}/metadata`, 'deleted_ids'),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            callbacks.onDeletedIds!({
              barang: Array.isArray(data.barang) ? data.barang : [],
              pelanggan: Array.isArray(data.pelanggan) ? data.pelanggan : [],
              transaksi: Array.isArray(data.transaksi) ? data.transaksi : []
            });
          }
        },
        (error) => {
          console.warn("Soft deleted_ids listen warning:", error);
        }
      )
    : () => {};

  const unsubSettings = callbacks.onSettings
    ? onSnapshot(
        doc(db, 'users', uid),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            callbacks.onSettings!({
              config: data.config,
              minBelanja: data.minBelanja,
              nilaiPoin: data.nilaiPoin
            });
          }
        },
        (error) => {
          console.warn("Soft settings listen warning:", error);
        }
      )
    : () => {};

  // Return joint unsubscribe callback
  return () => {
    unsubBarang();
    unsubPelanggan();
    unsubTransaksi();
    unsubPesananOnline();
    unsubDeletedIds();
    unsubSettings();
  };
};

/**
 * Retrieve current database from cloud (for merge / conflict resolution dialog)
 */
export const fetchCloudDatabase = async (uid: string) => {
  const path = `users/${uid}`;
  try {
    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);
    const settings = userSnap.exists() ? userSnap.data() : null;

    const queryBarang = await getDocs(collection(db, `users/${uid}/barang`));
    const barangList: ItemBarang[] = [];
    queryBarang.forEach((docSnap) => {
      barangList.push(docSnap.data() as ItemBarang);
    });

    const queryPelanggan = await getDocs(collection(db, `users/${uid}/pelanggan`));
    const pelangganList: Pelanggan[] = [];
    queryPelanggan.forEach((docSnap) => {
      pelangganList.push(docSnap.data() as Pelanggan);
    });

    const queryTransaksi = await getDocs(collection(db, `users/${uid}/transaksi`));
    const transaksiList: Transaksi[] = [];
    queryTransaksi.forEach((docSnap) => {
      transaksiList.push(docSnap.data() as Transaksi);
    });

    const docRef = doc(db, `users/${uid}/metadata`, 'deleted_ids');
    const docSnap = await getDoc(docRef);
    let deletedIds = { barang: [] as string[], pelanggan: [] as string[], transaksi: [] as string[] };
    if (docSnap.exists()) {
      const data = docSnap.data();
      deletedIds = {
        barang: Array.isArray(data.barang) ? data.barang : [],
        pelanggan: Array.isArray(data.pelanggan) ? data.pelanggan : [],
        transaksi: Array.isArray(data.transaksi) ? data.transaksi : []
      };
    }

    return {
      barang: barangList,
      pelanggan: pelangganList,
      transaksi: transaksiList,
      deletedIds,
      settings: settings ? {
        config: settings.config,
        minBelanja: settings.minBelanja,
        nilaiPoin: settings.nilaiPoin
      } : null
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
};

/**
 * Write or update deleted IDs in the cloud
 */
export const syncDeletedIdsToCloud = async (
  uid: string,
  deletedIds: { barang: string[]; pelanggan: string[]; transaksi: string[] }
) => {
  const path = `users/${uid}/metadata/deleted_ids`;
  try {
    const docRef = doc(db, `users/${uid}/metadata`, 'deleted_ids');
    await setDoc(docRef, deletedIds);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

/**
 * Retrieve deleted IDs from the cloud
 */
export const fetchDeletedIdsFromCloud = async (uid: string) => {
  try {
    const docRef = doc(db, `users/${uid}/metadata`, 'deleted_ids');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        barang: Array.isArray(data.barang) ? data.barang : [],
        pelanggan: Array.isArray(data.pelanggan) ? data.pelanggan : [],
        transaksi: Array.isArray(data.transaksi) ? data.transaksi : []
      };
    }
  } catch (error) {}
  return { barang: [], pelanggan: [], transaksi: [] };
};

/**
 * Write or update config / settings directly inside the user's primary document
 */
export const syncSettingsToCloud = async (
  uid: string,
  payload: { config: any; minBelanja: number; nilaiPoin: number }
) => {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export interface StoreCloudUser {
  uid: string;
  email: string;
  displayName: string;
  isStoreAccount: boolean;
  photoURL?: string;
  isAnonymous?: boolean;
}

export const deriveStoreKey = (input: string): string => {
  const clean = input.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `store_${clean}`;
};

/**
 * Universal Store Account Login & Registration:
 * 100% works across Android APK, WebView, and Web without domain restrictions or Google OAuth blocks.
 * If account already exists -> checks password and logs in.
 * If account does not exist -> creates the store account and connects automatically.
 */
export const loginOrRegisterStoreAccount = async (
  emailOrId: string,
  pass: string,
  storeName?: string,
  _explicitRegister?: boolean
): Promise<StoreCloudUser> => {
  const cleanInput = emailOrId.trim().toLowerCase();
  if (!cleanInput) throw new Error("Mohon masukkan email atau ID Toko Anda.");
  if (!pass || pass.trim().length < 4) throw new Error("Kata sandi minimal 4 karakter.");

  const storeKey = deriveStoreKey(cleanInput);
  const credRef = doc(db, 'users', storeKey, 'account', 'credentials');
  const snap = await getDoc(credRef);

  if (snap.exists()) {
    const data = snap.data();
    if (data.password && data.password !== pass.trim()) {
      throw new Error("Kata sandi salah untuk akun toko ini. Mohon periksa kembali sandi Anda.");
    }
    // Update last login
    await setDoc(credRef, { lastLogin: new Date().toISOString() }, { merge: true });
    const user: StoreCloudUser = {
      uid: storeKey,
      email: data.email || cleanInput,
      displayName: data.storeName || storeName || 'SRC MASNGUD',
      isStoreAccount: true
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('cfg_store_auth_user', JSON.stringify(user));
      localStorage.setItem('cfg_firestore_sync', 'true');
    }
    return user;
  } else {
    // Register new store account directly
    const newStoreName = (storeName && storeName.trim()) ? storeName.trim() : 'SRC MASNGUD';
    const payload = {
      storeKey,
      email: cleanInput,
      storeName: newStoreName,
      password: pass.trim(),
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    await setDoc(credRef, payload);
    const user: StoreCloudUser = {
      uid: storeKey,
      email: cleanInput,
      displayName: newStoreName,
      isStoreAccount: true
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('cfg_store_auth_user', JSON.stringify(user));
      localStorage.setItem('cfg_firestore_sync', 'true');
    }
    return user;
  }
};

export const getStoredStoreAccount = (): StoreCloudUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('cfg_store_auth_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const logoutStoreAccount = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('cfg_store_auth_user');
    localStorage.removeItem('cfg_firestore_sync');
  }
};

