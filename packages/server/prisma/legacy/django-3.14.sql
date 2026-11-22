-- BLEX 3.x SQLite schema at Django migration 0070_author_subscription.
-- Existing databases register this baseline after the documented schema check.

CREATE TABLE "auth_group" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(150) NOT NULL UNIQUE);

CREATE TABLE "auth_group_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "auth_permission" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "content_type_id" integer NOT NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "codename" varchar(100) NOT NULL, "name" varchar(255) NOT NULL);

CREATE TABLE "auth_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "password" varchar(128) NOT NULL, "last_login" datetime NULL, "is_superuser" bool NOT NULL, "username" varchar(150) NOT NULL UNIQUE, "last_name" varchar(150) NOT NULL, "email" varchar(254) NOT NULL, "is_staff" bool NOT NULL, "is_active" bool NOT NULL, "date_joined" datetime NOT NULL, "first_name" varchar(150) NOT NULL);

CREATE TABLE "auth_user_groups" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "auth_user_user_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_authorinvite" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "code" varchar(64) NOT NULL UNIQUE, "note" varchar(120) NOT NULL, "is_active" bool NOT NULL, "created_date" datetime NOT NULL, "claimed_date" datetime NULL, "claimed_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "created_by_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_authorsubscription" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "created_date" datetime NOT NULL, "author_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "subscriber_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "board_authorsub_unique_pair" UNIQUE ("subscriber_id", "author_id"), CONSTRAINT "board_authorsub_not_self" CHECK (NOT ("subscriber_id" = ("author_id"))));

CREATE TABLE "board_authorsubscriptionlog" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "action" varchar(16) NOT NULL, "created_date" datetime NOT NULL, "author_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "subscriber_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_comment" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "text_md" text NOT NULL, "text_html" text NOT NULL, "edited" bool NOT NULL, "heart" bool NOT NULL, "created_date" datetime NOT NULL, "author_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "post_id" integer NOT NULL REFERENCES "board_post" ("id") DEFERRABLE INITIALLY DEFERRED, "parent_id" integer NULL REFERENCES "board_comment" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_comment_likes" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "comment_id" integer NOT NULL REFERENCES "board_comment" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_config" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" integer NOT NULL UNIQUE REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "language" varchar(16) NULL, "time_zone" varchar(64) NOT NULL);

CREATE TABLE "board_developerrequestlog" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "method" varchar(10) NOT NULL, "path" varchar(255) NOT NULL, "status_code" smallint unsigned NOT NULL CHECK ("status_code" >= 0), "ip_address" char(39) NULL, "user_agent" varchar(255) NOT NULL, "created_date" datetime NOT NULL, "token_id" integer NULL REFERENCES "board_developertoken" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_developertoken" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(100) NOT NULL, "token_prefix" varchar(16) NOT NULL UNIQUE, "token_hash" varchar(64) NOT NULL UNIQUE, "scopes" text NOT NULL CHECK ((JSON_VALID("scopes") OR "scopes" IS NULL)), "expires_at" datetime NULL, "revoked_at" datetime NULL, "last_used_at" datetime NULL, "last_used_ip" char(39) NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_edithistory" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "content" text NOT NULL, "created_date" datetime NOT NULL, "post_id" integer NOT NULL REFERENCES "board_post" ("id") DEFERRABLE INITIALLY DEFERRED, "actor_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "change_type" varchar(16) NOT NULL, "description" varchar(250) NOT NULL, "source_updated_date" datetime NULL, "subtitle" varchar(120) NOT NULL, "tags" text NOT NULL CHECK ((JSON_VALID("tags") OR "tags" IS NULL)), "title" varchar(65) NOT NULL, "restored_from_id" integer NULL REFERENCES "board_edithistory" ("id") DEFERRABLE INITIALLY DEFERRED, "content_excerpt" varchar(160) NULL);

CREATE TABLE "board_editrequest" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(50) NOT NULL, "content" text NOT NULL, "is_merged" bool NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "post_id" integer NOT NULL REFERENCES "board_post" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_emailchange" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "email" varchar(255) NOT NULL, "auth_token" varchar(8) NOT NULL, "created_date" datetime NOT NULL, "user_id" integer NOT NULL UNIQUE REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_form" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(50) NOT NULL, "content" text NOT NULL, "is_public" bool NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_imagecache" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "key" varchar(44) NOT NULL UNIQUE, "path" varchar(128) NOT NULL UNIQUE, "size" integer NOT NULL, "user_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_integrationsetting" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "telegram_enabled" bool NOT NULL, "telegram_bot_username" varchar(64) NOT NULL, "telegram_bot_token" text NOT NULL, "updated_date" datetime NOT NULL);

CREATE TABLE "board_loginattempt" ("key" varchar(64) NOT NULL PRIMARY KEY, "window" bigint unsigned NOT NULL CHECK ("window" >= 0), "count" smallint unsigned NOT NULL CHECK ("count" >= 0));

CREATE TABLE "board_loginsetting" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "welcome_notification_message" text NOT NULL, "welcome_notification_url" varchar(255) NOT NULL, "account_deletion_redirect_url" varchar(500) NOT NULL, "hcaptcha_enabled" bool NOT NULL, "hcaptcha_site_key" varchar(255) NOT NULL, "hcaptcha_secret_key" text NOT NULL, "updated_date" datetime NOT NULL);

CREATE TABLE "board_notify" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "key" varchar(44) NOT NULL UNIQUE, "url" varchar(255) NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "content" text NOT NULL, "has_read" bool NOT NULL, "message_key" varchar(64) NOT NULL, "message_params" text NOT NULL CHECK ((JSON_VALID("message_params") OR "message_params" IS NULL)));

CREATE TABLE "board_oauthauthorization" ("state_hash" varchar(64) NOT NULL PRIMARY KEY, "expires_at" datetime NOT NULL);

CREATE TABLE "board_pinnedpost" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "order" integer NOT NULL, "created_date" datetime NOT NULL, "post_id" integer NOT NULL REFERENCES "board_post" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "board_pinned_user_post_uniq" UNIQUE ("user_id", "post_id"));

CREATE TABLE "board_post" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(65) NOT NULL, "url" varchar(65) NOT NULL UNIQUE, "image" varchar(100) NOT NULL, "read_time" integer NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "author_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "series_id" integer NULL REFERENCES "board_series" ("id") DEFERRABLE INITIALLY DEFERRED, "meta_description" varchar(250) NOT NULL, "subtitle" varchar(120) NOT NULL, "published_date" datetime NULL, "image_hash" varchar(64) NOT NULL, "deleted_date" datetime NULL);

CREATE TABLE "board_post_likes" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "created_date" datetime NOT NULL, "post_id" integer NOT NULL REFERENCES "board_post" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "board_postlike_post_user_uniq" UNIQUE ("post_id", "user_id"));

CREATE TABLE "board_post_share_link_daily_counts" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "day" date NOT NULL, "clicks" bigint unsigned NOT NULL CHECK ("clicks" >= 0), "link_id" integer NOT NULL REFERENCES "board_postsharelink" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "board_postsharelink_day_uniq" UNIQUE ("link_id", "day"));

CREATE TABLE "board_post_tags" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "post_id" integer NOT NULL REFERENCES "board_post" ("id") DEFERRABLE INITIALLY DEFERRED, "tag_id" integer NOT NULL REFERENCES "board_tag" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_postconfig" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "hide" bool NOT NULL, "advertise" bool NOT NULL, "block_comment" bool NOT NULL, "post_id" integer NOT NULL UNIQUE REFERENCES "board_post" ("id") DEFERRABLE INITIALLY DEFERRED, "cover_image_position" varchar(8) NOT NULL, "cover_image_ratio" varchar(8) NOT NULL, "cover_layout" varchar(16) NOT NULL);

CREATE TABLE "board_postconfigmeta" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(255) NOT NULL, "value" varchar(255) NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "post_id" integer NOT NULL REFERENCES "board_post" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_postcontent" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "content_html" text NOT NULL, "post_id" integer NOT NULL UNIQUE REFERENCES "board_post" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_postsharelink" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "token" varchar(22) NOT NULL UNIQUE, "label" varchar(100) NOT NULL, "is_paused" bool NOT NULL, "created_date" datetime NOT NULL, "post_id" integer NOT NULL REFERENCES "board_post" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_profile" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "bio" text NOT NULL, "cover" varchar(100) NOT NULL, "avatar" varchar(100) NOT NULL, "homepage" varchar(100) NOT NULL, "about_md" text NOT NULL, "about_html" text NOT NULL, "user_id" integer NOT NULL UNIQUE REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "analytics_share_url" varchar(500) NOT NULL, "role" varchar(10) NOT NULL);

CREATE TABLE "board_series" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "order" integer NOT NULL, "text_md" text NOT NULL, "text_html" text NOT NULL, "hide" bool NOT NULL, "url" varchar(50) NOT NULL UNIQUE, "layout" varchar(5) NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "owner_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "name" varchar(50) NOT NULL);

CREATE TABLE "board_seriesconfigmeta" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(50) NOT NULL, "value" varchar(255) NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "post_id" integer NOT NULL REFERENCES "board_series" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_sitebanner" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "scope" varchar(10) NOT NULL, "title" varchar(200) NOT NULL, "is_active" bool NOT NULL, "order" integer NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "content_html" text NOT NULL, "banner_type" varchar(20) NOT NULL, "position" varchar(10) NOT NULL, "user_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_sitenotice" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "scope" varchar(10) NOT NULL, "title" varchar(200) NOT NULL, "is_active" bool NOT NULL, "order" integer NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "url" varchar(255) NOT NULL, "user_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_sitesetting" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "header_script" text NOT NULL, "footer_script" text NOT NULL, "updated_date" datetime NOT NULL, "aeo_enabled" bool NOT NULL, "seo_enabled" bool NOT NULL, "robots_txt_extra_rules" text NOT NULL, "site_name" varchar(80) NOT NULL, "logo_svg" varchar(100) NOT NULL, "logo_svg_dark" varchar(100) NOT NULL, "icon_svg" varchar(100) NOT NULL, "icon_svg_dark" varchar(100) NOT NULL, "icon_manifest" text NOT NULL CHECK ((JSON_VALID("icon_manifest") OR "icon_manifest" IS NULL)));

CREATE TABLE "board_socialauth" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "uid" varchar(50) NOT NULL, "extra_data" text NOT NULL, "created_date" datetime NOT NULL, "provider_id" integer NOT NULL REFERENCES "board_socialauthprovider" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, CONSTRAINT "unique_social_auth_provider_uid" UNIQUE ("provider_id", "uid"));

CREATE TABLE "board_socialauthprovider" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "key" varchar(20) NOT NULL UNIQUE, "client_id" varchar(255) NOT NULL, "client_secret" text NOT NULL, "is_enabled" bool NOT NULL);

CREATE TABLE "board_staticpage" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(200) NOT NULL, "content" text NOT NULL, "meta_description" varchar(160) NOT NULL, "is_published" bool NOT NULL, "show_in_footer" bool NOT NULL, "order" integer NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "author_id" integer NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "slug" varchar(100) NOT NULL UNIQUE);

CREATE TABLE "board_tag" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "value" varchar(50) NOT NULL, CONSTRAINT "board_tag_value_uniq" UNIQUE ("value"));

CREATE TABLE "board_telegramsync" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "auth_token" varchar(8) NOT NULL, "auth_token_exp" datetime NOT NULL, "created_date" datetime NOT NULL, "user_id" integer NOT NULL UNIQUE REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "tid" varchar(200) NOT NULL);

CREATE TABLE "board_twofactorauth" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "recovery_key" varchar(64) NOT NULL, "created_date" datetime NOT NULL, "user_id" integer NOT NULL UNIQUE REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "totp_secret" text NOT NULL);

CREATE TABLE "board_userconfigmeta" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(50) NOT NULL, "value" varchar(255) NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_userlinkmeta" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(50) NOT NULL, "value" varchar(255) NOT NULL, "created_date" datetime NOT NULL, "updated_date" datetime NOT NULL, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "order" integer NOT NULL);

CREATE TABLE "board_usernamechangelog" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "username" varchar(50) NOT NULL, "created_date" datetime NOT NULL, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_utilitycleanupconfirmation" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "token_hash" varchar(64) NOT NULL UNIQUE, "action" varchar(32) NOT NULL, "session_fingerprint" varchar(64) NOT NULL, "expires_at" datetime NOT NULL, "consumed_at" datetime NULL, "created_date" datetime NOT NULL, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_webhooksubscription" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "webhook_url" varchar(500) NOT NULL, "name" varchar(100) NOT NULL, "is_active" bool NOT NULL, "failure_count" smallint unsigned NOT NULL CHECK ("failure_count" >= 0), "last_success_date" datetime NULL, "created_date" datetime NOT NULL, "scope" varchar(10) NOT NULL, "author_id" integer NULL REFERENCES "board_profile" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_worklog" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(100) NOT NULL, "created_at" datetime NOT NULL, "owner_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_worklogentry" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(100) NOT NULL, "text" text NOT NULL, "media_type" varchar(24) NOT NULL, "attachment" varchar(100) NOT NULL, "created_at" datetime NOT NULL, "log_id" integer NOT NULL REFERENCES "board_worklog" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_worklogshare" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "token" char(32) NOT NULL UNIQUE, "headline" varchar(120) NOT NULL, "created_at" datetime NOT NULL, "log_id" integer NOT NULL REFERENCES "board_worklog" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "board_worklogshare_entries" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "worklogshare_id" integer NOT NULL REFERENCES "board_worklogshare" ("id") DEFERRABLE INITIALLY DEFERRED, "worklogentry_id" integer NOT NULL REFERENCES "board_worklogentry" ("id") DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "django_admin_log" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "object_id" text NULL, "object_repr" varchar(200) NOT NULL, "action_flag" smallint unsigned NOT NULL CHECK ("action_flag" >= 0), "change_message" text NOT NULL, "content_type_id" integer NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "action_time" datetime NOT NULL);

CREATE TABLE "django_content_type" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app_label" varchar(100) NOT NULL, "model" varchar(100) NOT NULL);

CREATE TABLE "django_migrations" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app" varchar(255) NOT NULL, "name" varchar(255) NOT NULL, "applied" datetime NOT NULL);

CREATE TABLE "django_session" ("session_key" varchar(40) NOT NULL PRIMARY KEY, "session_data" text NOT NULL, "expire_date" datetime NOT NULL);

CREATE TABLE "django_site" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(50) NOT NULL, "domain" varchar(100) NOT NULL UNIQUE);

CREATE INDEX "auth_group_permissions_group_id_b120cbf9" ON "auth_group_permissions" ("group_id");

CREATE UNIQUE INDEX "auth_group_permissions_group_id_permission_id_0cd325b0_uniq" ON "auth_group_permissions" ("group_id", "permission_id");

CREATE INDEX "auth_group_permissions_permission_id_84c5c92e" ON "auth_group_permissions" ("permission_id");

CREATE INDEX "auth_permission_content_type_id_2f476e4b" ON "auth_permission" ("content_type_id");

CREATE UNIQUE INDEX "auth_permission_content_type_id_codename_01ab375a_uniq" ON "auth_permission" ("content_type_id", "codename");

CREATE INDEX "auth_user_groups_group_id_97559544" ON "auth_user_groups" ("group_id");

CREATE INDEX "auth_user_groups_user_id_6a12ed8b" ON "auth_user_groups" ("user_id");

CREATE UNIQUE INDEX "auth_user_groups_user_id_group_id_94350c0c_uniq" ON "auth_user_groups" ("user_id", "group_id");

CREATE INDEX "auth_user_user_permissions_permission_id_1fbb5f2c" ON "auth_user_user_permissions" ("permission_id");

CREATE INDEX "auth_user_user_permissions_user_id_a95ead1b" ON "auth_user_user_permissions" ("user_id");

CREATE UNIQUE INDEX "auth_user_user_permissions_user_id_permission_id_14a6b632_uniq" ON "auth_user_user_permissions" ("user_id", "permission_id");

CREATE INDEX "board_autho_claimed_0188bf_idx" ON "board_authorinvite" ("claimed_by_id");

CREATE INDEX "board_autho_code_e7ed63_idx" ON "board_authorinvite" ("code", "is_active");

CREATE INDEX "board_authorinvite_claimed_by_id_7a8026eb" ON "board_authorinvite" ("claimed_by_id");

CREATE INDEX "board_authorinvite_created_by_id_0cd57a38" ON "board_authorinvite" ("created_by_id");

CREATE INDEX "board_authorsub_author_idx" ON "board_authorsubscription" ("author_id", "created_date");

CREATE INDEX "board_authorsublog_author_idx" ON "board_authorsubscriptionlog" ("author_id", "created_date");

CREATE INDEX "board_authorsubscription_author_id_8b00b85d" ON "board_authorsubscription" ("author_id");

CREATE INDEX "board_authorsubscription_subscriber_id_27e581a7" ON "board_authorsubscription" ("subscriber_id");

CREATE INDEX "board_authorsubscriptionlog_author_id_9430554d" ON "board_authorsubscriptionlog" ("author_id");

CREATE INDEX "board_authorsubscriptionlog_subscriber_id_55114cf2" ON "board_authorsubscriptionlog" ("subscriber_id");

CREATE INDEX "board_comme_author__e4042f_idx" ON "board_comment" ("author_id", "created_date");

CREATE INDEX "board_comme_post_id_260f64_idx" ON "board_comment" ("post_id", "parent_id", "created_date");

CREATE INDEX "board_comment_author_id_08705ab7" ON "board_comment" ("author_id");

CREATE INDEX "board_comment_likes_comment_id_3ab8c714" ON "board_comment_likes" ("comment_id");

CREATE UNIQUE INDEX "board_comment_likes_comment_id_user_id_c6d811be_uniq" ON "board_comment_likes" ("comment_id", "user_id");

CREATE INDEX "board_comment_likes_user_id_4c484ae1" ON "board_comment_likes" ("user_id");

CREATE INDEX "board_comment_parent_id_511c6974" ON "board_comment" ("parent_id");

CREATE INDEX "board_comment_post_id_0a1699af" ON "board_comment" ("post_id");

CREATE INDEX "board_devel_token_i_fbbd82_idx" ON "board_developerrequestlog" ("token_id", "created_date");

CREATE INDEX "board_devel_token_p_7a12b4_idx" ON "board_developertoken" ("token_prefix");

CREATE INDEX "board_devel_user_id_bf372b_idx" ON "board_developertoken" ("user_id", "revoked_at");

CREATE INDEX "board_devel_user_id_e88d8c_idx" ON "board_developerrequestlog" ("user_id", "created_date");

CREATE INDEX "board_developerrequestlog_token_id_ea1cc060" ON "board_developerrequestlog" ("token_id");

CREATE INDEX "board_developerrequestlog_user_id_123587fb" ON "board_developerrequestlog" ("user_id");

CREATE INDEX "board_developertoken_user_id_24b231ab" ON "board_developertoken" ("user_id");

CREATE INDEX "board_edith_post_id_50a332_idx" ON "board_edithistory" ("post_id", "created_date");

CREATE INDEX "board_edithistory_actor_id_13dc7485" ON "board_edithistory" ("actor_id");

CREATE INDEX "board_edithistory_post_id_7ac2da0d" ON "board_edithistory" ("post_id");

CREATE INDEX "board_edithistory_restored_from_id_fdd2f281" ON "board_edithistory" ("restored_from_id");

CREATE INDEX "board_editrequest_post_id_77346467" ON "board_editrequest" ("post_id");

CREATE INDEX "board_editrequest_user_id_0deec073" ON "board_editrequest" ("user_id");

CREATE INDEX "board_form_user_id_1f43b269" ON "board_form" ("user_id");

CREATE INDEX "board_imagecache_user_id_a52aef7a" ON "board_imagecache" ("user_id");

CREATE INDEX "board_loginattempt_window_a08cc5bd" ON "board_loginattempt" ("window");

CREATE INDEX "board_notify_user_id_b069f0b5" ON "board_notify" ("user_id");

CREATE INDEX "board_oauthauthorization_expires_at_1587f3fa" ON "board_oauthauthorization" ("expires_at");

CREATE INDEX "board_pinnedpost_post_id_5c30f851" ON "board_pinnedpost" ("post_id");

CREATE INDEX "board_pinnedpost_user_id_162d6fde" ON "board_pinnedpost" ("user_id");

CREATE INDEX "board_post__post_id_ce5821_idx" ON "board_post_likes" ("post_id", "user_id");

CREATE INDEX "board_post__user_id_44c70b_idx" ON "board_post_likes" ("user_id", "created_date");

CREATE INDEX "board_post_author__54dd01_idx" ON "board_post" ("author_id", "published_date");

CREATE INDEX "board_post_author__effd83_idx" ON "board_post" ("author_id", "created_date");

CREATE INDEX "board_post_author_id_1d40598b" ON "board_post" ("author_id");

CREATE INDEX "board_post_created_69fd60_idx" ON "board_post" ("created_date");

CREATE INDEX "board_post_deleted_date_e66a3ffc" ON "board_post" ("deleted_date");

CREATE INDEX "board_post_image_hash_4631962a" ON "board_post" ("image_hash");

CREATE INDEX "board_post_likes_post_id_d498fb9b" ON "board_post_likes" ("post_id");

CREATE INDEX "board_post_likes_user_id_ec7f0988" ON "board_post_likes" ("user_id");

CREATE INDEX "board_post_publish_950f79_idx" ON "board_post" ("published_date");

CREATE INDEX "board_post_series_id_05abc0fb" ON "board_post" ("series_id");

CREATE INDEX "board_post_share_link_daily_counts_link_id_2f58d048" ON "board_post_share_link_daily_counts" ("link_id");

CREATE INDEX "board_post_tags_post_id_b46f227b" ON "board_post_tags" ("post_id");

CREATE UNIQUE INDEX "board_post_tags_post_id_tag_id_b584ff2b_uniq" ON "board_post_tags" ("post_id", "tag_id");

CREATE INDEX "board_post_tags_tag_id_7972a030" ON "board_post_tags" ("tag_id");

CREATE INDEX "board_post_url_7e049a_idx" ON "board_post" ("url");

CREATE INDEX "board_postconfigmeta_post_id_6e39a197" ON "board_postconfigmeta" ("post_id");

CREATE INDEX "board_postsharelink_post_id_4819c9d6" ON "board_postsharelink" ("post_id");

CREATE INDEX "board_series_owner_id_68a37f76" ON "board_series" ("owner_id");

CREATE INDEX "board_seriesconfigmeta_post_id_06b5e8ce" ON "board_seriesconfigmeta" ("post_id");

CREATE INDEX "board_siteb_scope_774e20_idx" ON "board_sitebanner" ("scope", "is_active", "banner_type", "position");

CREATE INDEX "board_siteb_user_id_7efe4d_idx" ON "board_sitebanner" ("user_id", "is_active");

CREATE INDEX "board_sitebanner_user_id_efebe8f0" ON "board_sitebanner" ("user_id");

CREATE INDEX "board_siten_scope_0b3bc6_idx" ON "board_sitenotice" ("scope", "is_active");

CREATE INDEX "board_siten_user_id_2b60d0_idx" ON "board_sitenotice" ("user_id", "is_active");

CREATE INDEX "board_sitenotice_user_id_354320c1" ON "board_sitenotice" ("user_id");

CREATE INDEX "board_socialauth_provider_id_6d0024d4" ON "board_socialauth" ("provider_id");

CREATE INDEX "board_socialauth_user_id_92dc0ec9" ON "board_socialauth" ("user_id");

CREATE INDEX "board_staticpage_author_id_fecbd454" ON "board_staticpage" ("author_id");

CREATE INDEX "board_userconfigmeta_user_id_da67eecd" ON "board_userconfigmeta" ("user_id");

CREATE INDEX "board_userlinkmeta_user_id_ba3f4047" ON "board_userlinkmeta" ("user_id");

CREATE INDEX "board_usern_usernam_873004_idx" ON "board_usernamechangelog" ("username");

CREATE INDEX "board_usernamechangelog_user_id_42630b04" ON "board_usernamechangelog" ("user_id");

CREATE INDEX "board_utilconfirm_exp_idx" ON "board_utilitycleanupconfirmation" ("expires_at");

CREATE INDEX "board_utilitycleanupconfirmation_user_id_1a58a3ed" ON "board_utilitycleanupconfirmation" ("user_id");

CREATE INDEX "board_webhooksubscription_author_id_8548ecb1" ON "board_webhooksubscription" ("author_id");

CREATE UNIQUE INDEX "board_webhooksubscription_scope_author_id_webhook_url_77edf147_uniq" ON "board_webhooksubscription" ("scope", "author_id", "webhook_url");

CREATE INDEX "board_worklog_owner_id_1954a244" ON "board_worklog" ("owner_id");

CREATE INDEX "board_worklogentry_log_id_13a54976" ON "board_worklogentry" ("log_id");

CREATE INDEX "board_worklogshare_entries_worklogentry_id_191c47f5" ON "board_worklogshare_entries" ("worklogentry_id");

CREATE INDEX "board_worklogshare_entries_worklogshare_id_4d45de92" ON "board_worklogshare_entries" ("worklogshare_id");

CREATE UNIQUE INDEX "board_worklogshare_entries_worklogshare_id_worklogentry_id_8cf8f20c_uniq" ON "board_worklogshare_entries" ("worklogshare_id", "worklogentry_id");

CREATE INDEX "board_worklogshare_log_id_6da80181" ON "board_worklogshare" ("log_id");

CREATE INDEX "django_admin_log_content_type_id_c4bce8eb" ON "django_admin_log" ("content_type_id");

CREATE INDEX "django_admin_log_user_id_c564eba6" ON "django_admin_log" ("user_id");

CREATE UNIQUE INDEX "django_content_type_app_label_model_76bd3d3b_uniq" ON "django_content_type" ("app_label", "model");

CREATE INDEX "django_session_expire_date_a5c62663" ON "django_session" ("expire_date");

CREATE INDEX "worklog_entry_timeline" ON "board_worklogentry" ("log_id", "created_at" DESC, "id" DESC);
