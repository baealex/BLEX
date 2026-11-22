-- CreateTable
CREATE TABLE "blex_oauth_flow" (
    "state_hash" TEXT NOT NULL PRIMARY KEY,
    "browser_hash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "return_path" TEXT NOT NULL,
    "expires_at" BIGINT NOT NULL,
    "session_hash" TEXT,
    "language" TEXT NOT NULL DEFAULT '',
    "time_zone" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "blex_oauth_challenge" (
    "token_hash" TEXT NOT NULL PRIMARY KEY,
    "social_auth_id" INTEGER NOT NULL,
    "return_path" TEXT NOT NULL,
    "expires_at" BIGINT NOT NULL,
    CONSTRAINT "blex_oauth_challenge_social_auth_id_fkey" FOREIGN KEY ("social_auth_id") REFERENCES "board_socialauth" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "auth_user" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "password" TEXT NOT NULL,
    "last_login" DATETIME,
    "is_superuser" BOOLEAN NOT NULL,
    "username" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "is_staff" BOOLEAN NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "date_joined" DATETIME NOT NULL,
    "first_name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "blex_session" (
    "token_hash" TEXT NOT NULL PRIMARY KEY,
    "user_id" INTEGER NOT NULL,
    "credential_tag" TEXT NOT NULL,
    "expires_at" BIGINT NOT NULL,
    "verified_until" BIGINT,
    "verified_factor_id" INTEGER,
    "requires_factor" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "blex_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "blex_factor_setup" (
    "session_hash" TEXT NOT NULL PRIMARY KEY,
    "secret" TEXT NOT NULL,
    "recovery_hash" TEXT NOT NULL,
    "expires_at" BIGINT NOT NULL,
    CONSTRAINT "blex_factor_setup_session_hash_fkey" FOREIGN KEY ("session_hash") REFERENCES "blex_session" ("token_hash") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "notificationId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "blex_scheduled_publication" (
    "post_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publish_at" TEXT NOT NULL,
    CONSTRAINT "blex_scheduled_publication_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "postId" INTEGER NOT NULL,
    "channelId" INTEGER NOT NULL,
    "availableAt" DATETIME NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("postId", "channelId"),
    CONSTRAINT "WebhookDelivery_postId_fkey" FOREIGN KEY ("postId") REFERENCES "board_post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebhookDelivery_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "WebhookChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "board_usernamechangelog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "board_usernamechangelog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_post" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "read_time" INTEGER NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "author_id" INTEGER NOT NULL,
    "series_id" INTEGER,
    "meta_description" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "published_date" DATETIME,
    "image_hash" TEXT NOT NULL,
    "deleted_date" DATETIME,
    CONSTRAINT "board_post_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "board_series" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_postcontent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content_html" TEXT NOT NULL,
    "post_id" INTEGER NOT NULL,
    CONSTRAINT "board_postcontent_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_postconfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hide" BOOLEAN NOT NULL,
    "advertise" BOOLEAN NOT NULL,
    "block_comment" BOOLEAN NOT NULL,
    "post_id" INTEGER NOT NULL,
    "cover_image_position" TEXT NOT NULL,
    "cover_image_ratio" TEXT NOT NULL,
    "cover_layout" TEXT NOT NULL,
    CONSTRAINT "board_postconfig_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "auth_group" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "auth_group_permissions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "group_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    CONSTRAINT "auth_group_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "auth_permission" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "auth_group_permissions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "auth_group" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "auth_permission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content_type_id" INTEGER NOT NULL,
    "codename" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "auth_permission_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "django_content_type" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "auth_user_groups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "group_id" INTEGER NOT NULL,
    CONSTRAINT "auth_user_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "auth_group" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "auth_user_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "auth_user_user_permissions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    CONSTRAINT "auth_user_user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "auth_permission" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "auth_user_user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_authorinvite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "created_date" DATETIME NOT NULL,
    "claimed_date" DATETIME,
    "claimed_by_id" INTEGER,
    "created_by_id" INTEGER,
    CONSTRAINT "board_authorinvite_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_authorinvite_claimed_by_id_fkey" FOREIGN KEY ("claimed_by_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_authorsubscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_date" DATETIME NOT NULL,
    "author_id" INTEGER NOT NULL,
    "subscriber_id" INTEGER NOT NULL,
    CONSTRAINT "board_authorsubscription_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_authorsubscription_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_authorsubscriptionlog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "author_id" INTEGER NOT NULL,
    "subscriber_id" INTEGER NOT NULL,
    CONSTRAINT "board_authorsubscriptionlog_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_authorsubscriptionlog_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_comment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "text_md" TEXT NOT NULL,
    "text_html" TEXT NOT NULL,
    "edited" BOOLEAN NOT NULL,
    "heart" BOOLEAN NOT NULL,
    "created_date" DATETIME NOT NULL,
    "author_id" INTEGER,
    "post_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    CONSTRAINT "board_comment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "board_comment" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_comment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_comment_likes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "comment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "board_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "board_comment" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "language" TEXT,
    "time_zone" TEXT NOT NULL,
    CONSTRAINT "board_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "DeveloperRequestLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "tokenId" INTEGER,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeveloperRequestLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeveloperRequestLog_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "DeveloperToken" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeveloperToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "lastUsedIp" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeveloperToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "board_edithistory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "post_id" INTEGER NOT NULL,
    "actor_id" INTEGER,
    "change_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source_updated_date" DATETIME,
    "subtitle" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "restored_from_id" INTEGER,
    "content_excerpt" TEXT,
    CONSTRAINT "board_edithistory_restored_from_id_fkey" FOREIGN KEY ("restored_from_id") REFERENCES "board_edithistory" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_edithistory_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_edithistory_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_editrequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_merged" BOOLEAN NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    "post_id" INTEGER NOT NULL,
    CONSTRAINT "board_editrequest_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_editrequest_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_emailchange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "auth_token" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "board_emailchange_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_loginattempt" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "window" BIGINT NOT NULL,
    "count" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "messageKey" TEXT NOT NULL DEFAULT '',
    "messageParams" JSONB NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "board_pinnedpost" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order" INTEGER NOT NULL,
    "created_date" DATETIME NOT NULL,
    "post_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "board_pinnedpost_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_pinnedpost_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_post_likes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "created_date" DATETIME NOT NULL,
    "post_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "board_post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_post_share_link_daily_counts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "day" DATETIME NOT NULL,
    "clicks" BIGINT NOT NULL,
    "link_id" INTEGER NOT NULL,
    CONSTRAINT "board_post_share_link_daily_counts_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "board_postsharelink" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_post_tags" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "post_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,
    CONSTRAINT "board_post_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "board_tag" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_post_tags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_postconfigmeta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "post_id" INTEGER NOT NULL,
    CONSTRAINT "board_postconfigmeta_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_postsharelink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_paused" BOOLEAN NOT NULL,
    "created_date" DATETIME NOT NULL,
    "post_id" INTEGER NOT NULL,
    CONSTRAINT "board_postsharelink_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_profile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bio" TEXT NOT NULL,
    "cover" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "homepage" TEXT NOT NULL,
    "about_md" TEXT NOT NULL,
    "about_html" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "analytics_share_url" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    CONSTRAINT "board_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_series" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order" INTEGER NOT NULL,
    "text_md" TEXT NOT NULL,
    "text_html" TEXT NOT NULL,
    "hide" BOOLEAN NOT NULL,
    "url" TEXT NOT NULL,
    "layout" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "board_series_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_seriesconfigmeta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "post_id" INTEGER NOT NULL,
    CONSTRAINT "board_seriesconfigmeta_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_series" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_socialauth" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "extra_data" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "board_socialauth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_socialauth_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "board_socialauthprovider" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_socialauthprovider" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "board_tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TelegramConnection" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegramId" TEXT NOT NULL DEFAULT '',
    "authToken" TEXT NOT NULL DEFAULT '',
    "authTokenExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "board_twofactorauth" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recovery_key" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    "totp_secret" TEXT NOT NULL,
    CONSTRAINT "board_twofactorauth_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_userconfigmeta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "board_userconfigmeta_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_userlinkmeta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "board_userlinkmeta_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "WebhookChannel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" INTEGER,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookChannel_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "django_content_type" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "app_label" TEXT NOT NULL,
    "model" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "WorkLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkLog_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkLogEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "logId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "mediaType" TEXT NOT NULL DEFAULT '',
    "attachment" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkLogEntry_logId_fkey" FOREIGN KEY ("logId") REFERENCES "WorkLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkLogShare" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "logId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkLogShare_logId_fkey" FOREIGN KEY ("logId") REFERENCES "WorkLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FormTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaticPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "authorId" INTEGER,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "showInFooter" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaticPage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "auth_user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteNotice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "scope" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteBanner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "scope" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "contentHtml" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteBanner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "siteName" TEXT NOT NULL DEFAULT 'BLEX',
    "domain" TEXT NOT NULL DEFAULT '',
    "headerScript" TEXT NOT NULL DEFAULT '',
    "footerScript" TEXT NOT NULL DEFAULT '',
    "seoEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aeoEnabled" BOOLEAN NOT NULL DEFAULT false,
    "robotsTxtExtraRules" TEXT NOT NULL DEFAULT '',
    "logoSvg" TEXT NOT NULL DEFAULT '',
    "logoSvgDark" TEXT NOT NULL DEFAULT '',
    "iconSvg" TEXT NOT NULL DEFAULT '',
    "iconSvgDark" TEXT NOT NULL DEFAULT '',
    "iconManifest" JSONB,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LoginSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "welcomeNotificationMessage" TEXT NOT NULL DEFAULT '',
    "welcomeNotificationUrl" TEXT NOT NULL DEFAULT '/',
    "accountDeletionRedirectUrl" TEXT NOT NULL DEFAULT '',
    "hcaptchaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "hcaptchaSiteKey" TEXT NOT NULL DEFAULT '',
    "hcaptchaSecretKey" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IntegrationSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "telegramBotUsername" TEXT NOT NULL DEFAULT '',
    "telegramBotToken" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "target" TEXT NOT NULL DEFAULT '',
    "objectId" TEXT,
    "objectName" TEXT NOT NULL DEFAULT '',
    "action" INTEGER NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CleanupConfirmation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "sessionFingerprint" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CleanupConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UploadedImage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "userId" INTEGER,
    CONSTRAINT "UploadedImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_WorkLogEntryToWorkLogShare" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_WorkLogEntryToWorkLogShare_A_fkey" FOREIGN KEY ("A") REFERENCES "WorkLogEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_WorkLogEntryToWorkLogShare_B_fkey" FOREIGN KEY ("B") REFERENCES "WorkLogShare" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "blex_oauth_flow_expires_at_idx" ON "blex_oauth_flow"("expires_at");

-- CreateIndex
CREATE INDEX "blex_oauth_challenge_social_auth_id_idx" ON "blex_oauth_challenge"("social_auth_id");

-- CreateIndex
CREATE INDEX "blex_oauth_challenge_expires_at_idx" ON "blex_oauth_challenge"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_user_username_key" ON "auth_user"("username");

-- CreateIndex
CREATE INDEX "blex_session_user_id_idx" ON "blex_session"("user_id");

-- CreateIndex
CREATE INDEX "blex_session_expires_at_idx" ON "blex_session"("expires_at");

-- CreateIndex
CREATE INDEX "NotificationDelivery_availableAt_idx" ON "NotificationDelivery"("availableAt");

-- CreateIndex
CREATE INDEX "blex_scheduled_publication_publish_at_idx" ON "blex_scheduled_publication"("publish_at");

-- CreateIndex
CREATE INDEX "WebhookDelivery_isDone_availableAt_idx" ON "WebhookDelivery"("isDone", "availableAt");

-- CreateIndex
CREATE INDEX "board_usern_usernam_873004_idx" ON "board_usernamechangelog"("username");

-- CreateIndex
CREATE INDEX "board_usernamechangelog_user_id_42630b04" ON "board_usernamechangelog"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_post_url_key" ON "board_post"("url");

-- CreateIndex
CREATE INDEX "board_post_deleted_date_e66a3ffc" ON "board_post"("deleted_date");

-- CreateIndex
CREATE INDEX "board_post_author__54dd01_idx" ON "board_post"("author_id", "published_date");

-- CreateIndex
CREATE INDEX "board_post_publish_950f79_idx" ON "board_post"("published_date");

-- CreateIndex
CREATE INDEX "board_post_url_7e049a_idx" ON "board_post"("url");

-- CreateIndex
CREATE INDEX "board_post_created_69fd60_idx" ON "board_post"("created_date");

-- CreateIndex
CREATE INDEX "board_post_author__effd83_idx" ON "board_post"("author_id", "created_date");

-- CreateIndex
CREATE INDEX "board_post_image_hash_4631962a" ON "board_post"("image_hash");

-- CreateIndex
CREATE INDEX "board_post_series_id_05abc0fb" ON "board_post"("series_id");

-- CreateIndex
CREATE INDEX "board_post_author_id_1d40598b" ON "board_post"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_postcontent_post_id_key" ON "board_postcontent"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_postconfig_post_id_key" ON "board_postconfig"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_group_name_key" ON "auth_group"("name");

-- CreateIndex
CREATE INDEX "auth_group_permissions_permission_id_84c5c92e" ON "auth_group_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "auth_group_permissions_group_id_b120cbf9" ON "auth_group_permissions"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_group_permissions_group_id_permission_id_0cd325b0_uniq" ON "auth_group_permissions"("group_id", "permission_id");

-- CreateIndex
CREATE INDEX "auth_permission_content_type_id_2f476e4b" ON "auth_permission"("content_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_permission_content_type_id_codename_01ab375a_uniq" ON "auth_permission"("content_type_id", "codename");

-- CreateIndex
CREATE INDEX "auth_user_groups_group_id_97559544" ON "auth_user_groups"("group_id");

-- CreateIndex
CREATE INDEX "auth_user_groups_user_id_6a12ed8b" ON "auth_user_groups"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_user_groups_user_id_group_id_94350c0c_uniq" ON "auth_user_groups"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "auth_user_user_permissions_permission_id_1fbb5f2c" ON "auth_user_user_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "auth_user_user_permissions_user_id_a95ead1b" ON "auth_user_user_permissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_user_user_permissions_user_id_permission_id_14a6b632_uniq" ON "auth_user_user_permissions"("user_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_authorinvite_code_key" ON "board_authorinvite"("code");

-- CreateIndex
CREATE INDEX "board_autho_claimed_0188bf_idx" ON "board_authorinvite"("claimed_by_id");

-- CreateIndex
CREATE INDEX "board_autho_code_e7ed63_idx" ON "board_authorinvite"("code", "is_active");

-- CreateIndex
CREATE INDEX "board_authorinvite_created_by_id_0cd57a38" ON "board_authorinvite"("created_by_id");

-- CreateIndex
CREATE INDEX "board_authorinvite_claimed_by_id_7a8026eb" ON "board_authorinvite"("claimed_by_id");

-- CreateIndex
CREATE INDEX "board_authorsub_author_idx" ON "board_authorsubscription"("author_id", "created_date");

-- CreateIndex
CREATE INDEX "board_authorsubscription_subscriber_id_27e581a7" ON "board_authorsubscription"("subscriber_id");

-- CreateIndex
CREATE INDEX "board_authorsubscription_author_id_8b00b85d" ON "board_authorsubscription"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_authorsubscription_subscriber_id_author_id_key" ON "board_authorsubscription"("subscriber_id", "author_id");

-- CreateIndex
CREATE INDEX "board_authorsublog_author_idx" ON "board_authorsubscriptionlog"("author_id", "created_date");

-- CreateIndex
CREATE INDEX "board_authorsubscriptionlog_subscriber_id_55114cf2" ON "board_authorsubscriptionlog"("subscriber_id");

-- CreateIndex
CREATE INDEX "board_authorsubscriptionlog_author_id_9430554d" ON "board_authorsubscriptionlog"("author_id");

-- CreateIndex
CREATE INDEX "board_comme_author__e4042f_idx" ON "board_comment"("author_id", "created_date");

-- CreateIndex
CREATE INDEX "board_comme_post_id_260f64_idx" ON "board_comment"("post_id", "parent_id", "created_date");

-- CreateIndex
CREATE INDEX "board_comment_parent_id_511c6974" ON "board_comment"("parent_id");

-- CreateIndex
CREATE INDEX "board_comment_post_id_0a1699af" ON "board_comment"("post_id");

-- CreateIndex
CREATE INDEX "board_comment_author_id_08705ab7" ON "board_comment"("author_id");

-- CreateIndex
CREATE INDEX "board_comment_likes_user_id_4c484ae1" ON "board_comment_likes"("user_id");

-- CreateIndex
CREATE INDEX "board_comment_likes_comment_id_3ab8c714" ON "board_comment_likes"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_comment_likes_comment_id_user_id_c6d811be_uniq" ON "board_comment_likes"("comment_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_config_user_id_key" ON "board_config"("user_id");

-- CreateIndex
CREATE INDEX "DeveloperRequestLog_tokenId_createdAt_idx" ON "DeveloperRequestLog"("tokenId", "createdAt");

-- CreateIndex
CREATE INDEX "DeveloperRequestLog_userId_createdAt_idx" ON "DeveloperRequestLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperToken_tokenPrefix_key" ON "DeveloperToken"("tokenPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperToken_tokenHash_key" ON "DeveloperToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DeveloperToken_userId_revokedAt_idx" ON "DeveloperToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "board_edith_post_id_50a332_idx" ON "board_edithistory"("post_id", "created_date");

-- CreateIndex
CREATE INDEX "board_edithistory_restored_from_id_fdd2f281" ON "board_edithistory"("restored_from_id");

-- CreateIndex
CREATE INDEX "board_edithistory_actor_id_13dc7485" ON "board_edithistory"("actor_id");

-- CreateIndex
CREATE INDEX "board_edithistory_post_id_7ac2da0d" ON "board_edithistory"("post_id");

-- CreateIndex
CREATE INDEX "board_editrequest_post_id_77346467" ON "board_editrequest"("post_id");

-- CreateIndex
CREATE INDEX "board_editrequest_user_id_0deec073" ON "board_editrequest"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_emailchange_user_id_key" ON "board_emailchange"("user_id");

-- CreateIndex
CREATE INDEX "board_loginattempt_window_a08cc5bd" ON "board_loginattempt"("window");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_key_key" ON "Notification"("key");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "board_pinnedpost_user_id_162d6fde" ON "board_pinnedpost"("user_id");

-- CreateIndex
CREATE INDEX "board_pinnedpost_post_id_5c30f851" ON "board_pinnedpost"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_pinnedpost_user_id_post_id_key" ON "board_pinnedpost"("user_id", "post_id");

-- CreateIndex
CREATE INDEX "board_post__user_id_44c70b_idx" ON "board_post_likes"("user_id", "created_date");

-- CreateIndex
CREATE INDEX "board_post__post_id_ce5821_idx" ON "board_post_likes"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "board_post_likes_user_id_ec7f0988" ON "board_post_likes"("user_id");

-- CreateIndex
CREATE INDEX "board_post_likes_post_id_d498fb9b" ON "board_post_likes"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_post_likes_post_id_user_id_key" ON "board_post_likes"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "board_post_share_link_daily_counts_link_id_2f58d048" ON "board_post_share_link_daily_counts"("link_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_post_share_link_daily_counts_link_id_day_key" ON "board_post_share_link_daily_counts"("link_id", "day");

-- CreateIndex
CREATE INDEX "board_post_tags_tag_id_7972a030" ON "board_post_tags"("tag_id");

-- CreateIndex
CREATE INDEX "board_post_tags_post_id_b46f227b" ON "board_post_tags"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_post_tags_post_id_tag_id_b584ff2b_uniq" ON "board_post_tags"("post_id", "tag_id");

-- CreateIndex
CREATE INDEX "board_postconfigmeta_post_id_6e39a197" ON "board_postconfigmeta"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_postsharelink_token_key" ON "board_postsharelink"("token");

-- CreateIndex
CREATE INDEX "board_postsharelink_post_id_4819c9d6" ON "board_postsharelink"("post_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_profile_user_id_key" ON "board_profile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_series_url_key" ON "board_series"("url");

-- CreateIndex
CREATE INDEX "board_series_owner_id_68a37f76" ON "board_series"("owner_id");

-- CreateIndex
CREATE INDEX "board_seriesconfigmeta_post_id_06b5e8ce" ON "board_seriesconfigmeta"("post_id");

-- CreateIndex
CREATE INDEX "board_socialauth_user_id_92dc0ec9" ON "board_socialauth"("user_id");

-- CreateIndex
CREATE INDEX "board_socialauth_provider_id_6d0024d4" ON "board_socialauth"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_socialauth_provider_id_uid_key" ON "board_socialauth"("provider_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "board_socialauthprovider_key_key" ON "board_socialauthprovider"("key");

-- CreateIndex
CREATE UNIQUE INDEX "board_tag_value_key" ON "board_tag"("value");

-- CreateIndex
CREATE UNIQUE INDEX "board_twofactorauth_user_id_key" ON "board_twofactorauth"("user_id");

-- CreateIndex
CREATE INDEX "board_userconfigmeta_user_id_da67eecd" ON "board_userconfigmeta"("user_id");

-- CreateIndex
CREATE INDEX "board_userlinkmeta_user_id_ba3f4047" ON "board_userlinkmeta"("user_id");

-- CreateIndex
CREATE INDEX "WebhookChannel_ownerId_idx" ON "WebhookChannel"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookChannel_scope_ownerId_url_key" ON "WebhookChannel"("scope", "ownerId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "django_content_type_app_label_model_76bd3d3b_uniq" ON "django_content_type"("app_label", "model");

-- CreateIndex
CREATE INDEX "WorkLog_ownerId_idx" ON "WorkLog"("ownerId");

-- CreateIndex
CREATE INDEX "WorkLogEntry_logId_createdAt_id_idx" ON "WorkLogEntry"("logId", "createdAt" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WorkLogShare_token_key" ON "WorkLogShare"("token");

-- CreateIndex
CREATE INDEX "WorkLogShare_logId_idx" ON "WorkLogShare"("logId");

-- CreateIndex
CREATE INDEX "FormTemplate_userId_idx" ON "FormTemplate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaticPage_slug_key" ON "StaticPage"("slug");

-- CreateIndex
CREATE INDEX "StaticPage_authorId_idx" ON "StaticPage"("authorId");

-- CreateIndex
CREATE INDEX "SiteNotice_userId_isActive_idx" ON "SiteNotice"("userId", "isActive");

-- CreateIndex
CREATE INDEX "SiteNotice_scope_isActive_idx" ON "SiteNotice"("scope", "isActive");

-- CreateIndex
CREATE INDEX "SiteBanner_userId_isActive_idx" ON "SiteBanner"("userId", "isActive");

-- CreateIndex
CREATE INDEX "SiteBanner_scope_isActive_type_position_idx" ON "SiteBanner"("scope", "isActive", "type", "position");

-- CreateIndex
CREATE INDEX "AdminLog_userId_idx" ON "AdminLog"("userId");

-- CreateIndex
CREATE INDEX "AdminLog_createdAt_idx" ON "AdminLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CleanupConfirmation_tokenHash_key" ON "CleanupConfirmation"("tokenHash");

-- CreateIndex
CREATE INDEX "CleanupConfirmation_expiresAt_idx" ON "CleanupConfirmation"("expiresAt");

-- CreateIndex
CREATE INDEX "CleanupConfirmation_userId_idx" ON "CleanupConfirmation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadedImage_key_key" ON "UploadedImage"("key");

-- CreateIndex
CREATE UNIQUE INDEX "UploadedImage_path_key" ON "UploadedImage"("path");

-- CreateIndex
CREATE INDEX "UploadedImage_userId_idx" ON "UploadedImage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "_WorkLogEntryToWorkLogShare_AB_unique" ON "_WorkLogEntryToWorkLogShare"("A", "B");

-- CreateIndex
CREATE INDEX "_WorkLogEntryToWorkLogShare_B_index" ON "_WorkLogEntryToWorkLogShare"("B");

