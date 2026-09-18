import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Reuse existing Firebase app instances if available
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request standard least-privilege Google Drive scope
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account'
});

// Cache variables
let isSigningIn = false;
let cachedAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('cfg_drive_access_token') : null;

/**
 * Initialize and listen to Auth status changes.
 * Calls onAuthSuccess once the user is signed in and provides the token if available.
 */
export const initDriveAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  // Capture redirect result if coming back from redirect sign-in
  if (typeof window !== 'undefined') {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            cachedAccessToken = credential.accessToken;
            localStorage.setItem('cfg_drive_access_token', cachedAccessToken);
            localStorage.setItem('cfg_drive_access_token_time', String(Date.now()));
            onAuthSuccess(result.user, credential.accessToken);
          }
        }
      })
      .catch((err) => {
        console.warn('Google redirect auth check:', err);
      });
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const tokenTimeStr = localStorage.getItem('cfg_drive_access_token_time');
      const tokenTime = tokenTimeStr ? parseInt(tokenTimeStr, 10) : 0;
      const isExpired = Date.now() - tokenTime > 50 * 60 * 1050; // 50 minutes to be safe

      if (cachedAccessToken && !isExpired) {
        onAuthSuccess(user, cachedAccessToken);
      } else {
        // Token has expired or state needs re-login
        cachedAccessToken = null;
        localStorage.removeItem('cfg_drive_access_token');
        localStorage.removeItem('cfg_drive_access_token_time');
        onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      localStorage.removeItem('cfg_drive_access_token');
      localStorage.removeItem('cfg_drive_access_token_time');
      onAuthFailure();
    }
  });
};

/**
 * Triggers sign-in popup using Firebase Auth for Google Account + Drive permissions
 * with fallback to redirect if popup is blocked in WebView
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        localStorage.setItem('cfg_drive_access_token', cachedAccessToken);
        localStorage.setItem('cfg_drive_access_token_time', String(Date.now()));
        return { user: result.user, accessToken: cachedAccessToken };
      }
    } catch (popupErr: any) {
      console.warn('Popup sign-in warning, attempting redirect fallback:', popupErr);
      const errCode = popupErr?.code || '';
      if (
        errCode === 'auth/popup-blocked' ||
        errCode === 'auth/operation-not-supported-in-this-environment' ||
        errCode === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(auth, provider);
        return null;
      }
      throw popupErr;
    }
    throw new Error('Gagal mendapatkan token akses dari Google.');
  } catch (error: any) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Signs out from Firebase Auth and clears memory token cache
 */
export const googleSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('cfg_drive_access_token');
  localStorage.removeItem('cfg_drive_access_token_time');
};

/**
 * Returns currently cached token or null
 */
export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Searches for srcmasngud_cloud_db.json or arapos_cloud_db.json file in user's Google Drive matching the applet scope
 */
export const searchDriveBackupFile = async (token: string): Promise<string | null> => {
  try {
    const query = encodeURIComponent("(name = 'srcmasngud_cloud_db.json' or name = 'arapos_cloud_db.json') and trashed = false");
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=name%20desc&fields=files(id,name,modifiedTime)`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('TOKEN_EXPIRED');
      }
      throw new Error(`Google Drive API error: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error: any) {
    console.error('Searching backup file in Drive failed:', error);
    if (error?.message === 'TOKEN_EXPIRED') {
      throw error;
    }
    return null;
  }
};

/**
 * Uploads (creates or overwrites) POS data JSON package in Google Drive
 */
export const uploadBackupToDrive = async (
  token: string,
  payload: { 
    barang: any[]; 
    pelanggan: any[]; 
    transaksi: any[];
    config?: any;
    minBelanjaPerPoin?: number;
    nilaiRupiahPerPoin?: number;
  }
): Promise<{ success: boolean; fileId?: string; error?: string }> => {
  try {
    // 1. Search if file already exists
    let fileId = await searchDriveBackupFile(token);

    const backupContent = JSON.stringify({
      ...payload,
      device: 'SRC-MASNGUD WEB-APP',
      v: 2,
      lastSyncedAt: new Date().toISOString()
    });

    if (!fileId) {
      // 2. Create the file metadata first
      const metadataResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'srcmasngud_cloud_db.json',
          mimeType: 'application/json',
          description: 'SRC MASNGUD Auto-sync database file'
        })
      });

      if (!metadataResponse.ok) {
        if (metadataResponse.status === 401) {
          throw new Error('TOKEN_EXPIRED');
        }
        throw new Error('Gagal membuat meta data file cadangan di Google Drive.');
      }

      const fileData = await metadataResponse.json();
      fileId = fileData.id;
    }

    if (!fileId) throw new Error('File ID tidak terdefinisi.');

    // 3. Upload content payload to existing or constructed file ID
    const uploadResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: backupContent
    });

    if (!uploadResponse.ok) {
      if (uploadResponse.status === 401) {
        throw new Error('TOKEN_EXPIRED');
      }
      throw new Error('Gagal mengunggah konten data baru ke Google Drive.');
    }

    return { success: true, fileId };
  } catch (error: any) {
    console.error('Backup upload failed:', error);
    if (error?.message === 'TOKEN_EXPIRED') {
      return { success: false, error: 'TOKEN_EXPIRED' };
    }
    return { success: false, error: error.message || 'Gagal menyimpan ke Google Drive.' };
  }
};

/**
 * Downloads POS database package from Google Drive file by ID and returns parsed JSON contents
 */
export const downloadBackupFromDrive = async (
  token: string,
  fileId: string
): Promise<{ success: boolean; data?: any; error?: string }> => {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('TOKEN_EXPIRED');
      }
      throw new Error('Gagal mengunduh isi data dari peranti Google Drive Anda.');
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error('Restore download failed:', error);
    if (error?.message === 'TOKEN_EXPIRED') {
      return { success: false, error: 'TOKEN_EXPIRED' };
    }
    return { success: false, error: error.message || ' Gagal memulihkan data dari Google Drive.' };
  }
};
