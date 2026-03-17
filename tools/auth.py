"""
tools/auth.py
Shared Google OAuth helper for all XMS tools.

Reads credentials from credentials.json at project root.
Persists token to token.json (refresh handled automatically).

Scopes cover GSC + GA4 + Google Ads read access.
"""

import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = [
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/adwords',
]

_ROOT = os.path.join(os.path.dirname(__file__), '..')
CREDENTIALS_FILE = os.path.join(_ROOT, 'credentials.json')
TOKEN_FILE       = os.path.join(_ROOT, 'token.json')


def get_credentials() -> Credentials:
    """Return valid Google credentials, refreshing or re-authorising as needed."""
    creds = None

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            # Opens a browser window — run once per machine, then token.json is reused
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, 'w') as fh:
            fh.write(creds.to_json())

    return creds
