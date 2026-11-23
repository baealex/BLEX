# Social Login Setup

BLEX supports Google and GitHub sign-in. Store provider credentials in the admin settings.

## Setup

1. Create an OAuth app in the provider's developer console. For Google, select the **Web application** type.
2. Register the callback below, replacing `https://blog.example.com` with your BLEX `SITE_URL`.

   | Provider | Callback URL | Requested scopes |
   | --- | --- | --- |
   | Google | `https://blog.example.com/login/callback/google` | `openid email profile` |
   | GitHub | `https://blog.example.com/login/callback/github` | `user:email` |

3. Open `/admin-settings/login`, enable the provider, and save its Client ID and Client Secret.
4. Sign out and verify sign-in through the provider's button on the login or signup screen.

The local Node app uses `http://localhost:8040`; Docker Compose defaults to `http://localhost:20002`. Use the actual base URL, including its port, in the callback.

## Credentials and access

- Leaving the Client Secret blank preserves the saved value. To delete it, select the option to clear the saved secret.
- Secrets are encrypted with `CIPHER_KEY`. Back up this key with the environment file and database; changing or losing it prevents decryption.
- Disabled providers or providers without valid credentials do not show a sign-in button. Disabled providers also reject direct callback requests.

## Troubleshooting

- `redirect_uri_mismatch`: check that the callback registered with the provider matches `SITE_URL`, including scheme, hostname, and port.
- Missing button or failed authentication: check provider activation, Client ID, and Client Secret in the admin settings.
- For HTTPS proxy configuration, follow the [self-hosting guide](SELF_HOSTING.md#https-reverse-proxy).
