# Social Login Setup

Configure social login providers and credentials in the **admin settings**. BLEX stores these settings in the database. BLEX supports Google and GitHub.

## Setup

1. Create an OAuth application in the provider's developer console.
2. Register the redirect URI or callback URL:
   - Google: `https://YOUR_DOMAIN/login/callback/google`
   - GitHub: `https://YOUR_DOMAIN/login/callback/github`
3. Open `/admin-settings/login` in BLEX.
4. Enable the provider in the social login section.
5. Enter its **Client ID** and **Client Secret**, then save.
6. Sign out and check that the social login button appears on the login and signup screens.

For local development, use your local base URL in place of `https://YOUR_DOMAIN`, for example `http://localhost:8040`.

## Google

In Google Cloud Console, create an OAuth client and select the **Web application** type.

- Authorized redirect URIs:
  - Production: `https://YOUR_DOMAIN/login/callback/google`
  - Local: `http://localhost:8040/login/callback/google`

BLEX requests the `openid`, `email`, and `profile` scopes.

## GitHub

Create an OAuth App in GitHub Developer settings.

- Authorization callback URL:
  - Production: `https://YOUR_DOMAIN/login/callback/github`
  - Local: `http://localhost:8040/login/callback/github`

BLEX requests the `user:email` scope.

## Behavior

- Disabled providers do not appear on the login or signup screens.
- A provider also stays hidden if its Client ID or Client Secret is empty.
- Login attempts through a disabled provider are rejected, including direct requests to its callback URL.
- Leaving the Client Secret field blank when saving preserves the existing secret.
- To delete a stored secret, select the option to clear the saved Client Secret, then save.
- Client Secrets are encrypted with `CIPHER_KEY` before being stored in the database.

## Troubleshooting

- For `redirect_uri_mismatch`, check that the callback URL derived from `SITE_URL` matches the URL registered with the provider. Make sure the HTTPS reverse proxy forwards the public hostname and protocol.
- If a button is missing, check that the provider is enabled and its Client ID is saved in BLEX.
- If authentication fails after the provider redirects back, check that the Client Secret is saved.
- Set `SITE_URL` to the base URL visitors use, including the scheme and port. Docker Compose defaults to `http://localhost:20002`, so callbacks must use that port too. See the [self-hosting guide](SELF_HOSTING.md) for HTTPS proxy setup.
- If `CIPHER_KEY` is lost or changed, BLEX cannot decrypt stored Client Secrets. Back up the key along with the database.
