export interface AdminSettingsUser {
  id: number;
  username: string;
  hasEditorRole?: boolean;
  isStaff?: boolean;
}

export interface AdminInvite {
  id: number;
  code: string;
  note: string;
  signupUrl: string;
  isActive: boolean;
  isClaimed: boolean;
  createdBy: string;
  claimedBy: string;
  createdDate: string | null;
  claimedDate: string | null;
}

export interface AdminStaticPage {
  id: number;
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  isPublished: boolean;
  showInFooter: boolean;
  order: number;
  createdDate: string;
  updatedDate: string;
}

export interface AdminNotice {
  id: number;
  title: string;
  url: string;
  isActive: boolean;
  createdDate: string;
  updatedDate: string;
}

export interface AdminBanner {
  id: number;
  title: string;
  contentHtml: string;
  bannerType: string;
  position: string;
  isActive: boolean;
  order: number;
  createdDate: string;
  updatedDate: string;
  createdBy: string | null;
}

export interface AdminManagedUser {
  id: number;
  username: string;
  name: string;
  email: string;
  role: 'READER' | 'EDITOR';
  isActive: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
  canChangeRole: boolean;
  postCount: number;
  dateJoined: string | null;
  lastLogin: string | null;
}

export interface AdminUserList {
  users: AdminManagedUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  stats: { total: number; editors: number; readers: number; admins: number };
}

export interface AdminIntegrationSettings {
  telegramEnabled: boolean;
  telegramBotUsername: string;
  telegramHasBotToken: boolean;
  updatedDate: string;
  telegramConnection: { state: string; detail: string };
}

export interface AdminSiteSettings {
  siteName: string;
  siteDescription: string;
  logoSvgUrl: string;
  logoSvgDarkUrl: string;
  iconSvgUrl: string;
  iconSvgDarkUrl: string;
  faviconUrl: string;
  iconPngUrls: Record<string, string>;
  hasCustomLogo: boolean;
  hasCustomLogoDark: boolean;
  hasCustomIcon: boolean;
  hasCustomIconDark: boolean;
  headerScript: string;
  footerScript: string;
  canManageScripts: boolean;
  seoEnabled: boolean;
  robotsTxtExtraRules: string;
  robotsTxtDefault: string;
  aeoEnabled: boolean;
  updatedDate: string;
}

export interface AdminSocialProvider {
  key: string;
  name: string;
  isEnabled: boolean;
  clientId: string;
  hasClientSecret: boolean;
}

export interface AdminLoginSettings {
  welcomeNotificationMessage: string;
  welcomeNotificationUrl: string;
  accountDeletionRedirectUrl: string;
  hcaptchaEnabled: boolean;
  hcaptchaSiteKey: string;
  hcaptchaHasSecretKey: boolean;
  updatedDate: string;
  socialAuthProviders: AdminSocialProvider[];
}
