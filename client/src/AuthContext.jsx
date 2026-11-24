import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest } from "./api.js";

const AuthContext = createContext(null);
const STORAGE_KEY = "zuri-healthcare-session";
const validRoles = new Set(["patient", "doctor", "admin"]);

function readSession() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    if (!storedValue) return null;

    const session = JSON.parse(storedValue);

    if (
      typeof session.token !== "string" ||
      !session.user ||
      !validRoles.has(session.user.role)
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return session;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readSession);

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  async function login(credentials) {
    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    setSession(response.data);
    return response.data.user;
  }

  async function register(patientDetails) {
    const response = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify(patientDetails),
    });

    setSession(response.data);
    return response.data.user;
  }

  function logout() {
    setSession(null);
  }

  const value = useMemo(
    () => ({
      token: session?.token || null,
      user: session?.user || null,
      login,
      register,
      logout,
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }

  return context;
}