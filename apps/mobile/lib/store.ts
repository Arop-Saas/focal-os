import { create } from "zustand";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

interface StaffInfo {
  id: string;
  title: string | null;
  avatarUrl: string | null;
  phone: string | null;
  homeTerritoryId: string | null;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface AppState {
  // Auth
  isAuthenticated: boolean;
  accessToken: string | null;
  user: UserInfo | null;
  staffProfile: StaffInfo | null;
  workspace: WorkspaceInfo | null;
  role: "ADMIN" | "MANAGER" | "PHOTOGRAPHER" | "EDITOR" | null;

  // Notifications
  pushToken: string | null;
  unreadCount: number;

  // Active job (for clock-in tracking)
  activeJobId: string | null;
  clockedInAt: string | null; // ISO string

  // Actions
  setAuth: (token: string, user: UserInfo) => void;
  setStaffProfile: (staff: StaffInfo) => void;
  setWorkspace: (workspace: WorkspaceInfo) => void;
  setRole: (role: AppState["role"]) => void;
  setPushToken: (token: string) => void;
  setUnreadCount: (count: number) => void;
  setActiveJob: (jobId: string | null, clockedInAt: string | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  isAuthenticated: false,
  accessToken: null,
  user: null,
  staffProfile: null,
  workspace: null,
  role: null,
  pushToken: null,
  unreadCount: 0,
  activeJobId: null,
  clockedInAt: null,

  // Actions
  setAuth: (token, user) =>
    set({ isAuthenticated: true, accessToken: token, user }),

  setStaffProfile: (staffProfile) => set({ staffProfile }),

  setWorkspace: (workspace) => set({ workspace }),

  setRole: (role) => set({ role }),

  setPushToken: (pushToken) => set({ pushToken }),

  setUnreadCount: (unreadCount) => set({ unreadCount }),

  setActiveJob: (activeJobId, clockedInAt) =>
    set({ activeJobId, clockedInAt }),

  logout: () =>
    set({
      isAuthenticated: false,
      accessToken: null,
      user: null,
      staffProfile: null,
      workspace: null,
      role: null,
      activeJobId: null,
      clockedInAt: null,
    }),
}));
