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
CREATE TABLE "blex_notification_delivery" (
    "notification_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" BIGINT NOT NULL,
    CONSTRAINT "blex_notification_delivery_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "board_notify" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "blex_scheduled_publication" (
    "post_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "publish_at" TEXT NOT NULL,
    CONSTRAINT "blex_scheduled_publication_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "blex_webhook_delivery" (
    "post_id" INTEGER NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "available_at" BIGINT NOT NULL,
    "done" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("post_id", "channel_id"),
    CONSTRAINT "blex_webhook_delivery_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "board_post" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT "blex_webhook_delivery_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "board_webhooksubscription" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
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
CREATE TABLE "board_developerrequestlog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "token_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "board_developerrequestlog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_developerrequestlog_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "board_developertoken" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_developertoken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "token_prefix" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "expires_at" DATETIME,
    "revoked_at" DATETIME,
    "last_used_at" DATETIME,
    "last_used_ip" TEXT,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "board_developertoken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
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
CREATE TABLE "board_form" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "board_form_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_imagecache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "user_id" INTEGER,
    CONSTRAINT "board_imagecache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_integrationsetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegram_enabled" BOOLEAN NOT NULL,
    "telegram_bot_username" TEXT NOT NULL,
    "telegram_bot_token" TEXT NOT NULL,
    "updated_date" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "board_loginattempt" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "window" BIGINT NOT NULL,
    "count" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "board_loginsetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "welcome_notification_message" TEXT NOT NULL,
    "welcome_notification_url" TEXT NOT NULL,
    "account_deletion_redirect_url" TEXT NOT NULL,
    "hcaptcha_enabled" BOOLEAN NOT NULL,
    "hcaptcha_site_key" TEXT NOT NULL,
    "hcaptcha_secret_key" TEXT NOT NULL,
    "updated_date" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "board_notify" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "has_read" BOOLEAN NOT NULL,
    "message_key" TEXT NOT NULL,
    "message_params" TEXT NOT NULL,
    CONSTRAINT "board_notify_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_oauthauthorization" (
    "state_hash" TEXT NOT NULL PRIMARY KEY,
    "expires_at" DATETIME NOT NULL
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
CREATE TABLE "board_sitebanner" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scope" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "content_html" TEXT NOT NULL,
    "banner_type" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "user_id" INTEGER,
    CONSTRAINT "board_sitebanner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_sitenotice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scope" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "url" TEXT NOT NULL,
    "user_id" INTEGER,
    CONSTRAINT "board_sitenotice_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_sitesetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "header_script" TEXT NOT NULL,
    "footer_script" TEXT NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "aeo_enabled" BOOLEAN NOT NULL,
    "seo_enabled" BOOLEAN NOT NULL,
    "robots_txt_extra_rules" TEXT NOT NULL,
    "site_name" TEXT NOT NULL,
    "logo_svg" TEXT NOT NULL,
    "logo_svg_dark" TEXT NOT NULL,
    "icon_svg" TEXT NOT NULL,
    "icon_svg_dark" TEXT NOT NULL,
    "icon_manifest" TEXT NOT NULL
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
CREATE TABLE "board_staticpage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "meta_description" TEXT NOT NULL,
    "is_published" BOOLEAN NOT NULL,
    "show_in_footer" BOOLEAN NOT NULL,
    "order" INTEGER NOT NULL,
    "created_date" DATETIME NOT NULL,
    "updated_date" DATETIME NOT NULL,
    "author_id" INTEGER,
    "slug" TEXT NOT NULL,
    CONSTRAINT "board_staticpage_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "board_telegramsync" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "auth_token" TEXT NOT NULL,
    "auth_token_exp" DATETIME NOT NULL,
    "created_date" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    "tid" TEXT NOT NULL,
    CONSTRAINT "board_telegramsync_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
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
CREATE TABLE "board_utilitycleanupconfirmation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token_hash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "session_fingerprint" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "consumed_at" DATETIME,
    "created_date" DATETIME NOT NULL,
    "user_id" INTEGER NOT NULL,
    CONSTRAINT "board_utilitycleanupconfirmation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_webhooksubscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "webhook_url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "failure_count" INTEGER NOT NULL,
    "last_success_date" DATETIME,
    "created_date" DATETIME NOT NULL,
    "scope" TEXT NOT NULL,
    "author_id" INTEGER,
    CONSTRAINT "board_webhooksubscription_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "board_profile" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_worklog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "owner_id" INTEGER NOT NULL,
    CONSTRAINT "board_worklog_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_worklogentry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "attachment" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "log_id" INTEGER NOT NULL,
    CONSTRAINT "board_worklogentry_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "board_worklog" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_worklogshare" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL,
    "log_id" INTEGER NOT NULL,
    CONSTRAINT "board_worklogshare_log_id_fkey" FOREIGN KEY ("log_id") REFERENCES "board_worklog" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "board_worklogshare_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "worklogshare_id" INTEGER NOT NULL,
    "worklogentry_id" INTEGER NOT NULL,
    CONSTRAINT "board_worklogshare_entries_worklogentry_id_fkey" FOREIGN KEY ("worklogentry_id") REFERENCES "board_worklogentry" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "board_worklogshare_entries_worklogshare_id_fkey" FOREIGN KEY ("worklogshare_id") REFERENCES "board_worklogshare" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "django_admin_log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "object_id" TEXT,
    "object_repr" TEXT NOT NULL,
    "action_flag" INTEGER NOT NULL,
    "change_message" TEXT NOT NULL,
    "content_type_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "action_time" DATETIME NOT NULL,
    CONSTRAINT "django_admin_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
    CONSTRAINT "django_admin_log_content_type_id_fkey" FOREIGN KEY ("content_type_id") REFERENCES "django_content_type" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

-- CreateTable
CREATE TABLE "django_content_type" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "app_label" TEXT NOT NULL,
    "model" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "django_session" (
    "session_key" TEXT NOT NULL PRIMARY KEY,
    "session_data" TEXT NOT NULL,
    "expire_date" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "django_site" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL
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
CREATE INDEX "blex_notification_delivery_available_at_idx" ON "blex_notification_delivery"("available_at");

-- CreateIndex
CREATE INDEX "blex_scheduled_publication_publish_at_idx" ON "blex_scheduled_publication"("publish_at");

-- CreateIndex
CREATE INDEX "blex_webhook_delivery_pending_idx" ON "blex_webhook_delivery"("done", "available_at");

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
CREATE INDEX "board_devel_token_i_fbbd82_idx" ON "board_developerrequestlog"("token_id", "created_date");

-- CreateIndex
CREATE INDEX "board_devel_user_id_e88d8c_idx" ON "board_developerrequestlog"("user_id", "created_date");

-- CreateIndex
CREATE INDEX "board_developerrequestlog_user_id_123587fb" ON "board_developerrequestlog"("user_id");

-- CreateIndex
CREATE INDEX "board_developerrequestlog_token_id_ea1cc060" ON "board_developerrequestlog"("token_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_developertoken_token_prefix_key" ON "board_developertoken"("token_prefix");

-- CreateIndex
CREATE UNIQUE INDEX "board_developertoken_token_hash_key" ON "board_developertoken"("token_hash");

-- CreateIndex
CREATE INDEX "board_devel_token_p_7a12b4_idx" ON "board_developertoken"("token_prefix");

-- CreateIndex
CREATE INDEX "board_devel_user_id_bf372b_idx" ON "board_developertoken"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "board_developertoken_user_id_24b231ab" ON "board_developertoken"("user_id");

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
CREATE INDEX "board_form_user_id_1f43b269" ON "board_form"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_imagecache_key_key" ON "board_imagecache"("key");

-- CreateIndex
CREATE UNIQUE INDEX "board_imagecache_path_key" ON "board_imagecache"("path");

-- CreateIndex
CREATE INDEX "board_imagecache_user_id_a52aef7a" ON "board_imagecache"("user_id");

-- CreateIndex
CREATE INDEX "board_loginattempt_window_a08cc5bd" ON "board_loginattempt"("window");

-- CreateIndex
CREATE UNIQUE INDEX "board_notify_key_key" ON "board_notify"("key");

-- CreateIndex
CREATE INDEX "board_notify_user_id_b069f0b5" ON "board_notify"("user_id");

-- CreateIndex
CREATE INDEX "board_oauthauthorization_expires_at_1587f3fa" ON "board_oauthauthorization"("expires_at");

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
CREATE INDEX "board_siteb_user_id_7efe4d_idx" ON "board_sitebanner"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "board_siteb_scope_774e20_idx" ON "board_sitebanner"("scope", "is_active", "banner_type", "position");

-- CreateIndex
CREATE INDEX "board_sitebanner_user_id_efebe8f0" ON "board_sitebanner"("user_id");

-- CreateIndex
CREATE INDEX "board_siten_user_id_2b60d0_idx" ON "board_sitenotice"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "board_siten_scope_0b3bc6_idx" ON "board_sitenotice"("scope", "is_active");

-- CreateIndex
CREATE INDEX "board_sitenotice_user_id_354320c1" ON "board_sitenotice"("user_id");

-- CreateIndex
CREATE INDEX "board_socialauth_user_id_92dc0ec9" ON "board_socialauth"("user_id");

-- CreateIndex
CREATE INDEX "board_socialauth_provider_id_6d0024d4" ON "board_socialauth"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_socialauth_provider_id_uid_key" ON "board_socialauth"("provider_id", "uid");

-- CreateIndex
CREATE UNIQUE INDEX "board_socialauthprovider_key_key" ON "board_socialauthprovider"("key");

-- CreateIndex
CREATE UNIQUE INDEX "board_staticpage_slug_key" ON "board_staticpage"("slug");

-- CreateIndex
CREATE INDEX "board_staticpage_author_id_fecbd454" ON "board_staticpage"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_tag_value_key" ON "board_tag"("value");

-- CreateIndex
CREATE UNIQUE INDEX "board_telegramsync_user_id_key" ON "board_telegramsync"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_twofactorauth_user_id_key" ON "board_twofactorauth"("user_id");

-- CreateIndex
CREATE INDEX "board_userconfigmeta_user_id_da67eecd" ON "board_userconfigmeta"("user_id");

-- CreateIndex
CREATE INDEX "board_userlinkmeta_user_id_ba3f4047" ON "board_userlinkmeta"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_utilitycleanupconfirmation_token_hash_key" ON "board_utilitycleanupconfirmation"("token_hash");

-- CreateIndex
CREATE INDEX "board_utilconfirm_exp_idx" ON "board_utilitycleanupconfirmation"("expires_at");

-- CreateIndex
CREATE INDEX "board_utilitycleanupconfirmation_user_id_1a58a3ed" ON "board_utilitycleanupconfirmation"("user_id");

-- CreateIndex
CREATE INDEX "board_webhooksubscription_author_id_8548ecb1" ON "board_webhooksubscription"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_webhooksubscription_scope_author_id_webhook_url_77edf147_uniq" ON "board_webhooksubscription"("scope", "author_id", "webhook_url");

-- CreateIndex
CREATE INDEX "board_worklog_owner_id_1954a244" ON "board_worklog"("owner_id");

-- CreateIndex
CREATE INDEX "board_worklogentry_log_id_13a54976" ON "board_worklogentry"("log_id");

-- CreateIndex
CREATE INDEX "worklog_entry_timeline" ON "board_worklogentry"("log_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "board_worklogshare_token_key" ON "board_worklogshare"("token");

-- CreateIndex
CREATE INDEX "board_worklogshare_log_id_6da80181" ON "board_worklogshare"("log_id");

-- CreateIndex
CREATE INDEX "board_worklogshare_entries_worklogentry_id_191c47f5" ON "board_worklogshare_entries"("worklogentry_id");

-- CreateIndex
CREATE INDEX "board_worklogshare_entries_worklogshare_id_4d45de92" ON "board_worklogshare_entries"("worklogshare_id");

-- CreateIndex
CREATE UNIQUE INDEX "board_worklogshare_entries_worklogshare_id_worklogentry_id_8cf8f20c_uniq" ON "board_worklogshare_entries"("worklogshare_id", "worklogentry_id");

-- CreateIndex
CREATE INDEX "django_admin_log_user_id_c564eba6" ON "django_admin_log"("user_id");

-- CreateIndex
CREATE INDEX "django_admin_log_content_type_id_c4bce8eb" ON "django_admin_log"("content_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "django_content_type_app_label_model_76bd3d3b_uniq" ON "django_content_type"("app_label", "model");

-- CreateIndex
CREATE INDEX "django_session_expire_date_a5c62663" ON "django_session"("expire_date");

-- CreateIndex
CREATE UNIQUE INDEX "django_site_domain_key" ON "django_site"("domain");

