export interface PersonalSettingsUser {
  id: number;
  username: string;
  hasEditorRole?: boolean;
  isStaff?: boolean;
  hasConnectedTelegram?: boolean;
  canUseTelegramIntegration?: boolean;
}

export interface RegionalPreferences {
  language: string | null;
  timeZone: string;
  defaultLanguage: string;
  defaultTimeZone: string;
  languages: Array<{ code: string; label: string }>;
  timeZones: string[];
}

export interface AccountSettingsView {
  username: string;
  name: string;
  email: string;
  createdDate: string;
  regionalPreferences: RegionalPreferences;
}

export interface ProfileSettingsView {
  avatar: string;
  cover: string | null;
  bio: string;
  homepage: string;
  social: Array<{ id: number; name: string; value: string; order: number }>;
}
