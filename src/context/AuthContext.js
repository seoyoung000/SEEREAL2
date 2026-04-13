import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../firebase/config";

const AuthContext = createContext({
  user: null,
  initializing: true,
  login: async () => {},
  loginWithEmail: async () => {},
  signupWithEmail: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const redirectToAccountSetup = () => {
    if (typeof window !== "undefined") {
      window.location.replace("/account-setup");
    }
  };

  const normalizeNotification = (prefs) => {
    const defaultPrefs = {
      enabled: true,
      channels: { email: true, sms: false },
    };

    if (!prefs) {
      return defaultPrefs;
    }

    return {
      enabled:
        typeof prefs.enabled === "boolean" ? prefs.enabled : defaultPrefs.enabled,
      channels: {
        email:
          typeof prefs.channels?.email === "boolean"
            ? prefs.channels.email
            : defaultPrefs.channels.email,
        sms:
          typeof prefs.channels?.sms === "boolean"
            ? prefs.channels.sms
            : defaultPrefs.channels.sms,
      },
    };
  };

  const loginWithGoogle = async () => {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const signedInUser = credential.user;
      if (!signedInUser) {
        return null;
      }

      const userRef = doc(db, "users", signedInUser.uid);
      const snapshot = await getDoc(userRef);

      if (!snapshot.exists()) {
        redirectToAccountSetup();
        return { user: signedInUser, needsSetup: true };
      }

      const profile = snapshot.data() || {};
      const notificationPrefs = normalizeNotification(profile.notification);

      const updates = {};
      const needsNotificationBootstrap = !profile.notification;

      if (needsNotificationBootstrap) {
        updates.notification = notificationPrefs;
      }

      if (!Array.isArray(profile.favoriteZones)) {
        updates.favoriteZones = [];
      }

      if (!profile.displayName && signedInUser.displayName) {
        updates.displayName = signedInUser.displayName;
      }

      if (!profile.email && signedInUser.email) {
        updates.email = signedInUser.email;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = serverTimestamp();
        await setDoc(userRef, updates, { merge: true });
      }

      return { user: signedInUser, needsSetup: false };
    } catch (error) {
      if (
        error?.code === "auth/cancelled-popup-request" ||
        error?.code === "auth/popup-closed-by-user"
      ) {
        return null;
      }
      throw error;
    }
  };

  const loginWithEmail = async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  };

  const signupWithEmail = async ({ email, password, displayName }) => {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (displayName) {
      try {
        await updateProfile(credential.user, { displayName });
      } catch (profileError) {
        console.warn("displayName 업데이트에 실패했습니다.", profileError);
      }
    }

    return credential.user;
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("로그아웃에 실패했습니다.", error);
    }
  };

  const value = useMemo(
    () => ({
      user,
      initializing,
      login: loginWithGoogle,
      loginWithGoogle,
      loginWithEmail,
      signupWithEmail,
      logout,
    }),
    [user, initializing, loginWithGoogle, loginWithEmail, signupWithEmail, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
