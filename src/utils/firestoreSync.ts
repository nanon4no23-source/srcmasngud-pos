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
import { matchMemberBarcode, getEan8Digits, getEan13Digits } from './printHelper';

// Reuse existing Firebase app instances if available
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

/**
 * Deep sanitization function to strip any `undefined` properties from objects
 * before sending to Firestore, preventing "Unsupported field value: undefined" errors.
 */
export const sanitizeForFirestore = <T>(obj: T): T => {
  if (obj === undefined || obj === null) return obj;
  if (typeof obj !== 'object') return obj;
  try {
    return JSON.parse(JSON.stringify(obj, (_, value) => (value === undefined ? null : value)));
  } catch {
    return obj;
  }
};

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
    await setDoc(docRef, sanitizeForFirestore(item));
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
    await setDoc(docRef, sanitizeForFirestore(p));
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
    await setDoc(docRef, sanitizeForFirestore(tx));
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
 * Write or Update a PesananOnline document in cloud Firestore across all candidate paths
 */
export const syncPesananOnlineToCloud = async (uids: string | string[], order: PesananOnline) => {
  const rawList = Array.isArray(uids) ? uids : [uids];
  const uniqueIds = Array.from(new Set([...rawList, 'store_nanon4no23_gmail_com'].filter(Boolean)));
  const sanitized = sanitizeForFirestore(order);

  await Promise.allSettled([
    ...uniqueIds.map(async (uid) => {
      try {
        const docRef = doc(db, `users/${uid}/pesanan_online`, order.id);
        await setDoc(docRef, sanitized);
      } catch (error) {
        console.warn(`Could not sync pesanan_online to users/${uid}:`, error);
      }
    }),
    (async () => {
      try {
        const rootRef = doc(db, 'pesanan_online', order.id);
        await setDoc(rootRef, sanitized);
      } catch (e) {
        console.warn('Could not sync pesanan_online to root collection:', e);
      }
    })()
  ]);
};

/**
 * Delete a PesananOnline document from cloud Firestore across all candidate paths
 */
export const deletePesananOnlineFromCloud = async (uids: string | string[], orderId: string) => {
  const rawList = Array.isArray(uids) ? uids : [uids];
  const uniqueIds = Array.from(new Set([...rawList, 'store_nanon4no23_gmail_com'].filter(Boolean)));

  await Promise.allSettled([
    ...uniqueIds.map(async (uid) => {
      try {
        const docRef = doc(db, `users/${uid}/pesanan_online`, orderId);
        await deleteDoc(docRef);
      } catch (error) {
        console.warn(`Could not delete pesanan_online from users/${uid}:`, error);
      }
    }),
    (async () => {
      try {
        const rootRef = doc(db, 'pesanan_online', orderId);
        await deleteDoc(rootRef);
      } catch (e) {
        console.warn('Could not delete pesanan_online from root collection:', e);
      }
    })()
  ]);
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
      operations.push({ ref, data: sanitizeForFirestore(item) });
    });

    payload.pelanggan.forEach((p) => {
      const ref = doc(db, `users/${uid}/pelanggan`, p.id);
      operations.push({ ref, data: sanitizeForFirestore(p) });
    });

    payload.transaksi.forEach((tx) => {
      const ref = doc(db, `users/${uid}/transaksi`, tx.id);
      operations.push({ ref, data: sanitizeForFirestore(tx) });
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
    onDeletedIds?: (deletedIds: { barang: string[]; pelanggan: string[]; transaksi: string[]; karyawan?: string[] }) => void;
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
              transaksi: Array.isArray(data.transaksi) ? data.transaksi : [],
              karyawan: Array.isArray(data.karyawan) ? data.karyawan : []
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
  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error('Koneksi database awan melebihi batas waktu (timeout).')), 15000)
  );

  const fetchPromise = (async () => {
    const userDocRef = doc(db, 'users', uid);
    const docDeletedRef = doc(db, `users/${uid}/metadata`, 'deleted_ids');

    // Query in parallel using Promise.all for fast execution on mobile networks
    const [userSnap, queryBarang, queryPelanggan, queryTransaksi, docDeletedSnap] = await Promise.all([
      getDoc(userDocRef).catch(() => null),
      getDocs(collection(db, `users/${uid}/barang`)).catch(() => null),
      getDocs(collection(db, `users/${uid}/pelanggan`)).catch(() => null),
      getDocs(collection(db, `users/${uid}/transaksi`)).catch(() => null),
      getDoc(docDeletedRef).catch(() => null)
    ]);

    const settings = userSnap && userSnap.exists() ? userSnap.data() : null;

    const barangList: ItemBarang[] = [];
    if (queryBarang) {
      queryBarang.forEach((docSnap) => {
        barangList.push(docSnap.data() as ItemBarang);
      });
    }

    const pelangganList: Pelanggan[] = [];
    if (queryPelanggan) {
      queryPelanggan.forEach((docSnap) => {
        pelangganList.push(docSnap.data() as Pelanggan);
      });
    }

    const transaksiList: Transaksi[] = [];
    if (queryTransaksi) {
      queryTransaksi.forEach((docSnap) => {
        transaksiList.push(docSnap.data() as Transaksi);
      });
    }

    let deletedIds = { barang: [] as string[], pelanggan: [] as string[], transaksi: [] as string[], karyawan: [] as string[] };
    if (docDeletedSnap && docDeletedSnap.exists()) {
      const data = docDeletedSnap.data();
      deletedIds = {
        barang: Array.isArray(data.barang) ? data.barang : [],
        pelanggan: Array.isArray(data.pelanggan) ? data.pelanggan : [],
        transaksi: Array.isArray(data.transaksi) ? data.transaksi : [],
        karyawan: Array.isArray(data.karyawan) ? data.karyawan : []
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
  })();

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    console.warn("fetchCloudDatabase notice or timeout:", error);
    return null;
  }
};

/**
 * Write or update deleted IDs in the cloud
 */
export const syncDeletedIdsToCloud = async (
  uid: string,
  deletedIds: { barang: string[]; pelanggan: string[]; transaksi: string[]; karyawan?: string[] }
) => {
  const path = `users/${uid}/metadata/deleted_ids`;
  try {
    const docRef = doc(db, `users/${uid}/metadata`, 'deleted_ids');
    await setDoc(docRef, sanitizeForFirestore(deletedIds));
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
        transaksi: Array.isArray(data.transaksi) ? data.transaksi : [],
        karyawan: Array.isArray(data.karyawan) ? data.karyawan : []
      };
    }
  } catch (error) {}
  return { barang: [], pelanggan: [], transaksi: [], karyawan: [] };
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
    await setDoc(docRef, sanitizeForFirestore(payload), { merge: true });
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

/**
 * Standardize phone string for member matching (e.g. 628 -> 08, 8 -> 08)
 */
export const normalizePhone = (phoneStr: string): string => {
  if (!phoneStr) return '';
  let clean = phoneStr.replace(/[^0-9]/g, '');
  if (clean.startsWith('62')) clean = '0' + clean.slice(2);
  else if (clean.startsWith('8')) clean = '0' + clean;
  return clean;
};

/**
 * Intelligently resolve the target store ID from URL parameter (?store=...),
 * custom user object, local storage of active store, or fallback to primary store (store_nanon4no23_gmail_com).
 */
export const resolveStoreId = (customUser?: any): string => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('store') || params.get('storeId') || params.get('toko');
    if (fromParam && fromParam.trim()) return fromParam.trim();

    if (window.location.hash) {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash.includes('store=')) {
        const hashParams = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : hash);
        const fromHash = hashParams.get('store') || hashParams.get('storeId') || hashParams.get('toko');
        if (fromHash && fromHash.trim()) return fromHash.trim();
      }
    }

    if (customUser?.email) return deriveStoreKey(customUser.email);
    if (customUser?.uid) return customUser.uid;

    const storedUser = getStoredStoreAccount();
    if (storedUser?.email) return deriveStoreKey(storedUser.email);
    if (storedUser?.uid) return storedUser.uid;

    if (auth.currentUser?.email) return deriveStoreKey(auth.currentUser.email);
    if (auth.currentUser?.uid) return auth.currentUser.uid;

    const lastStore = localStorage.getItem('src_active_store_id');
    if (lastStore && lastStore.trim()) return lastStore.trim();
  }
  // Default fallback to primary store: SRC MASNGUD
  return 'store_nanon4no23_gmail_com';
};

/**
 * Real-time listener for public buyer portal (CustomerOnlineStore)
 * Subscribes directly to the cloud store's barang, pelanggan, and settings
 */
export const listenToStoreForBuyer = (
  storeId: string,
  callbacks: {
    onBarang?: (items: ItemBarang[]) => void;
    onPelanggan?: (members: Pelanggan[]) => void;
    onSettings?: (settings: any) => void;
  }
) => {
  const targetStore = storeId || resolveStoreId();
  if (!targetStore) return () => {};

  const unsubBarang = callbacks.onBarang
    ? onSnapshot(
        collection(db, `users/${targetStore}/barang`),
        (snap) => {
          const list: ItemBarang[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as ItemBarang);
          });
          callbacks.onBarang!(list);
        },
        (err) => console.warn('Buyer store barang snapshot notice:', err)
      )
    : () => {};

  const unsubPelanggan = callbacks.onPelanggan
    ? onSnapshot(
        collection(db, `users/${targetStore}/pelanggan`),
        (snap) => {
          const list: Pelanggan[] = [];
          snap.forEach((docSnap) => {
            list.push(docSnap.data() as Pelanggan);
          });
          callbacks.onPelanggan!(list);
        },
        (err) => console.warn('Buyer store pelanggan snapshot notice:', err)
      )
    : () => {};

  const unsubSettings = callbacks.onSettings
    ? onSnapshot(
        doc(db, 'users', targetStore),
        (docSnap) => {
          if (docSnap.exists()) {
            callbacks.onSettings!(docSnap.data());
          }
        },
        (err) => console.warn('Buyer store settings snapshot notice:', err)
      )
    : () => {};

  return () => {
    unsubBarang();
    unsubPelanggan();
    unsubSettings();
  };
};

// Helper to prevent hanging Firestore network calls during offline/spotty connections
const withTimeout = <T>(promise: Promise<T>, ms = 8000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Koneksi timeout (offline)')), ms))
  ]);
};

/**
 * Submit an online order directly to the store's cloud database from customer device.
 * Dual-pushes to the targeted store path, primary store path (store_nanon4no23_gmail_com),
 * and root pesanan_online collection to guarantee 100% receipt by the cashier application.
 */
export const submitBuyerOrder = async (storeId: string, order: PesananOnline): Promise<boolean> => {
  const targetId = storeId || resolveStoreId();
  const canonicalId = 'store_nanon4no23_gmail_com';
  const candidateTargets = Array.from(new Set([targetId, canonicalId].filter(Boolean)));
  const payloadToSync: PesananOnline = {
    ...order,
    syncStatus: 'synced',
    syncedAt: new Date().toISOString()
  };
  const sanitized = sanitizeForFirestore(payloadToSync);
  let anySuccess = false;

  await Promise.allSettled([
    ...candidateTargets.map(async (tid) => {
      try {
        const docRef = doc(db, `users/${tid}/pesanan_online`, order.id);
        await withTimeout(setDoc(docRef, sanitized));
        anySuccess = true;
      } catch (err) {
        console.warn(`Could not push order to users/${tid}/pesanan_online:`, err);
      }
    }),
    (async () => {
      try {
        const rootRef = doc(db, 'pesanan_online', order.id);
        await withTimeout(setDoc(rootRef, { ...sanitized, storeId: targetId }));
        anySuccess = true;
      } catch (err) {
        console.warn('Could not push order to root pesanan_online collection:', err);
      }
    })()
  ]);

  return anySuccess;
};

/**
 * Dedicated Real-Time Listener for Cashier APK to receive online orders instantly.
 * Listens in parallel across all store identifiers (UID, Email Key, Store Name, and Root Collection)
 * so that regardless of how the customer submitted the order, it is immediately received.
 */
export const listenToIncomingOnlineOrders = (
  storeIds: string[],
  onOrders: (orders: PesananOnline[]) => void
): (() => void) => {
  const uniqueIds = Array.from(new Set([...storeIds, 'store_nanon4no23_gmail_com'].filter(Boolean)));
  const unsubs: (() => void)[] = [];
  const ordersMap = new Map<string, PesananOnline>();

  const notify = () => {
    const list = Array.from(ordersMap.values()).sort((a, b) => {
      const timeA = new Date(a.waktuPesan || 0).getTime();
      const timeB = new Date(b.waktuPesan || 0).getTime();
      return timeB - timeA;
    });
    onOrders(list);
  };

  uniqueIds.forEach(id => {
    try {
      const unsub = onSnapshot(
        collection(db, `users/${id}/pesanan_online`),
        (snapshot) => {
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as PesananOnline;
            if (data && data.id) {
              ordersMap.set(data.id, data);
            }
          });
          notify();
        },
        (error) => {
          console.warn(`Listener notice for users/${id}/pesanan_online:`, error);
        }
      );
      unsubs.push(unsub);
    } catch (e) {
      console.warn(`Error setting up snapshot for users/${id}:`, e);
    }
  });

  // Also listen to root pesanan_online collection
  try {
    const unsubRoot = onSnapshot(
      collection(db, 'pesanan_online'),
      (snapshot) => {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as PesananOnline;
          if (data && data.id) {
            ordersMap.set(data.id, data);
          }
        });
        notify();
      },
      (error) => {
        console.warn('Listener notice for root pesanan_online:', error);
      }
    );
    unsubs.push(unsubRoot);
  } catch (e) {
    console.warn('Error setting up snapshot for root pesanan_online:', e);
  }

  return () => {
    unsubs.forEach(fn => {
      try { fn(); } catch (_) {}
    });
  };
};

/**
 * On-demand direct fetch of all online orders across store paths (for initial load, manual pull, or heartbeat)
 */
export const fetchPesananOnlineFromCloud = async (storeIds: string[]): Promise<PesananOnline[]> => {
  const uniqueIds = Array.from(new Set([...storeIds, 'store_nanon4no23_gmail_com'].filter(Boolean)));
  const ordersMap = new Map<string, PesananOnline>();

  await Promise.allSettled([
    ...uniqueIds.map(async (id) => {
      try {
        const snap = await getDocs(collection(db, `users/${id}/pesanan_online`));
        snap.forEach((docSnap) => {
          const data = docSnap.data() as PesananOnline;
          if (data && data.id) {
            ordersMap.set(data.id, data);
          }
        });
      } catch (e) {
        console.warn(`Error fetching pesanan_online from users/${id}:`, e);
      }
    }),
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'pesanan_online'));
        snap.forEach((docSnap) => {
          const data = docSnap.data() as PesananOnline;
          if (data && data.id) {
            ordersMap.set(data.id, data);
          }
        });
      } catch (e) {
        console.warn('Error fetching root pesanan_online:', e);
      }
    })()
  ]);

  return Array.from(ordersMap.values()).sort((a, b) => {
    const timeA = new Date(a.waktuPesan || 0).getTime();
    const timeB = new Date(b.waktuPesan || 0).getTime();
    return timeB - timeA;
  });
};

/**
 * Register or update a member directly in the store's cloud database from customer device
 */
export const registerBuyerMember = async (storeId: string, member: Pelanggan): Promise<boolean> => {
  const targetId = storeId || resolveStoreId();
  const path = `users/${targetId}/pelanggan/${member.id}`;
  try {
    const docRef = doc(db, `users/${targetId}/pelanggan`, member.id);
    await setDoc(docRef, sanitizeForFirestore(member));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
};

/**
 * Live search for a member directly in the cloud (prioritizes exact barcode / ID first, then phone, then name)
 */
export const searchMemberInCloud = async (storeId: string, query: string): Promise<Pelanggan | null> => {
  if (!query || !query.trim()) return null;
  const targetId = storeId || resolveStoreId();
  const q = query.trim();
  const qLow = q.toLowerCase();
  const qClean = q.replace(/[^a-z0-9]/g, '');
  const qPhone = normalizePhone(q);

  try {
    const snap = await getDocs(collection(db, `users/${targetId}/pelanggan`));
    const members: Pelanggan[] = snap.docs.map(docSnap => {
      const data = docSnap.data() as Pelanggan;
      return {
        ...data,
        id: (data.id || docSnap.id).trim()
      };
    });

    // PASS 1: Strict Barcode / QR / Member ID match across ALL members first!
    for (const p of members) {
      const pId = p.id;
      const pIdLow = pId.toLowerCase();
      const pIdClean = pIdLow.replace(/[^a-z0-9]/g, '');

      if (matchMemberBarcode(pId, q)) return p;
      if (getEan8Digits(pId) === q || (qClean && getEan8Digits(pId) === qClean)) return p;
      if (getEan13Digits(pId) === q || (qClean && getEan13Digits(pId) === qClean)) return p;
      if (pIdLow === qLow || (qClean && pIdClean === qClean)) return p;

      // Display formatted ID comparison (e.g. MBR-...)
      const displayId = pId.toLowerCase().startsWith('mbr-') 
        ? pIdLow 
        : (pId.toLowerCase().startsWith('pel-') 
          ? `mbr-${pId.replace(/[^0-9]/g, '').slice(-4)}` 
          : `mbr-${pIdLow}`);
      const displayClean = displayId.replace(/[^a-z0-9]/g, '');
      if (displayId === qLow || (qClean && displayClean === qClean)) return p;
    }

    // PASS 2: Phone number match (ONLY if both query and member phone have >= 8 digits!)
    if (qPhone.length >= 8) {
      for (const p of members) {
        const pPhone = normalizePhone(p.telepon || '');
        if (pPhone.length >= 8 && (
          pPhone === qPhone || 
          pPhone.endsWith(qPhone) || 
          qPhone.endsWith(pPhone)
        )) {
          return p;
        }
      }
    }

    // PASS 3: Name exact or contains (ONLY if query is not purely numeric and has >= 3 characters)
    if (qLow.length >= 3 && !/^\d+$/.test(qClean)) {
      for (const p of members) {
        const pNameLow = (p.nama || '').toLowerCase().trim();
        if (pNameLow && (pNameLow === qLow || pNameLow.includes(qLow))) {
          return p;
        }
      }
    }
  } catch (error) {
    console.warn("Failed to search member in cloud:", error);
  }
  return null;
};


