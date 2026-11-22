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
CREATE TABLE "ScheduledPublication" (
    "postId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publishAt" DATETIME NOT NULL,
    CONSTRAINT "ScheduledPublication_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "postId" INTEGER NOT NULL,
    "channelId" INTEGER NOT NULL,
    "availableAt" DATETIME NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("postId", "channelId"),
    CONSTRAINT "WebhookDelivery_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
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
CREATE TABLE "Post" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "authorId" INTEGER NOT NULL,
    "seriesId" INTEGER,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "imageHash" TEXT NOT NULL DEFAULT '',
    "readTime" INTEGER NOT NULL DEFAULT 1,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isAdvertised" BOOLEAN NOT NULL DEFAULT false,
    "commentsBlocked" BOOLEAN NOT NULL DEFAULT false,
    "coverLayout" TEXT NOT NULL DEFAULT 'default',
    "coverImagePosition" TEXT NOT NULL DEFAULT 'right',
    "coverImageRatio" TEXT NOT NULL DEFAULT 'auto',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "deletedAt" DATETIME,
    "draftScheduledAt" DATETIME,
    CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Post_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostContent" (
    "postId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "html" TEXT NOT NULL,
    CONSTRAINT "PostContent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE TABLE "AuthorSubscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subscriberId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthorSubscription_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuthorSubscription_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthorSubscriptionLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subscriberId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthorSubscriptionLog_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuthorSubscriptionLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postId" INTEGER NOT NULL,
    "authorId" INTEGER,
    "parentId" INTEGER,
    "markdown" TEXT NOT NULL DEFAULT '',
    "html" TEXT NOT NULL DEFAULT '',
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isHearted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "auth_user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommentLike" (
    "commentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,

    PRIMARY KEY ("commentId", "userId"),
    CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE TABLE "PostRevision" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "restoredFromId" INTEGER,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "subtitle" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "contentExcerpt" TEXT,
    "tags" JSONB NOT NULL,
    "sourceUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostRevision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "auth_user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PostRevision_restoredFromId_fkey" FOREIGN KEY ("restoredFromId") REFERENCES "PostRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE TABLE "PinnedPost" (
    "userId" INTEGER NOT NULL,
    "postId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "postId"),
    CONSTRAINT "PinnedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PinnedPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostLike" (
    "postId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("postId", "userId"),
    CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostShareDailyCount" (
    "linkId" INTEGER NOT NULL,
    "day" DATETIME NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("linkId", "day"),
    CONSTRAINT "PostShareDailyCount_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "PostShareLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostShareLink" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "postId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostShareLink_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE TABLE "Series" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ownerId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "descriptionMarkdown" TEXT NOT NULL DEFAULT '',
    "descriptionHtml" TEXT NOT NULL DEFAULT '',
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "layout" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Series_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "auth_user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE TABLE "Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
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
CREATE TABLE "_PostToTag" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_PostToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_PostToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE INDEX "ScheduledPublication_publishAt_idx" ON "ScheduledPublication"("publishAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_isDone_availableAt_idx" ON "WebhookDelivery"("isDone", "availableAt");

-- CreateIndex
CREATE INDEX "board_usern_usernam_873004_idx" ON "board_usernamechangelog"("username");

-- CreateIndex
CREATE INDEX "board_usernamechangelog_user_id_42630b04" ON "board_usernamechangelog"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_authorId_publishedAt_idx" ON "Post"("authorId", "publishedAt");

-- CreateIndex
CREATE INDEX "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_publishedAt_idx" ON "Post"("publishedAt");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX "Post_deletedAt_idx" ON "Post"("deletedAt");

-- CreateIndex
CREATE INDEX "Post_seriesId_idx" ON "Post"("seriesId");

-- CreateIndex
CREATE INDEX "Post_imageHash_idx" ON "Post"("imageHash");

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
CREATE INDEX "AuthorSubscription_authorId_createdAt_idx" ON "AuthorSubscription"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorSubscription_subscriberId_authorId_key" ON "AuthorSubscription"("subscriberId", "authorId");

-- CreateIndex
CREATE INDEX "AuthorSubscriptionLog_authorId_createdAt_idx" ON "AuthorSubscriptionLog"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthorSubscriptionLog_subscriberId_idx" ON "AuthorSubscriptionLog"("subscriberId");

-- CreateIndex
CREATE INDEX "Comment_authorId_createdAt_idx" ON "Comment"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_postId_parentId_createdAt_idx" ON "Comment"("postId", "parentId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "CommentLike_userId_idx" ON "CommentLike"("userId");

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
CREATE INDEX "PostRevision_postId_createdAt_idx" ON "PostRevision"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "PostRevision_restoredFromId_idx" ON "PostRevision"("restoredFromId");

-- CreateIndex
CREATE INDEX "PostRevision_actorId_idx" ON "PostRevision"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "board_emailchange_user_id_key" ON "board_emailchange"("user_id");

-- CreateIndex
CREATE INDEX "board_loginattempt_window_a08cc5bd" ON "board_loginattempt"("window");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_key_key" ON "Notification"("key");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "PinnedPost_postId_idx" ON "PinnedPost"("postId");

-- CreateIndex
CREATE INDEX "PostLike_userId_createdAt_idx" ON "PostLike"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostShareLink_token_key" ON "PostShareLink"("token");

-- CreateIndex
CREATE INDEX "PostShareLink_postId_idx" ON "PostShareLink"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "board_profile_user_id_key" ON "board_profile"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");

-- CreateIndex
CREATE INDEX "Series_ownerId_idx" ON "Series"("ownerId");

-- CreateIndex
CREATE INDEX "board_socialauth_user_id_92dc0ec9" ON "board_socialauth"("user_id");

-- CreateIndex
CREATE INDEX "board_socialauth_provider_id_6d0024d4" ON "board_socialauth"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_socialauth_provider_id_uid_key" ON "board_socialauth"("provider_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "board_socialauthprovider_key_key" ON "board_socialauthprovider"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

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
CREATE UNIQUE INDEX "_PostToTag_AB_unique" ON "_PostToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_PostToTag_B_index" ON "_PostToTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_WorkLogEntryToWorkLogShare_AB_unique" ON "_WorkLogEntryToWorkLogShare"("A", "B");

-- CreateIndex
CREATE INDEX "_WorkLogEntryToWorkLogShare_B_index" ON "_WorkLogEntryToWorkLogShare"("B");

