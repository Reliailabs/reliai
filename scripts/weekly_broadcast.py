"""Weekly broadcast script — posts the latest What's New entry to Twitter/X.

Usage:
    python scripts/weekly_broadcast.py [--readme README.md] [--dry-run]

Reads the latest What's New bullet from README.md, composes a tweet (≤280 chars),
deduplicates against .github/last-broadcast-hash, and posts via Twitter v2 API
using OAuth 1.0a (stdlib only — no pip dependencies).

Secrets via environment variables:
    TWITTER_API_KEY
    TWITTER_API_SECRET
    TWITTER_ACCESS_TOKEN
    TWITTER_ACCESS_TOKEN_SECRET
    LINKEDIN_TOKEN  (optional)

If secrets are absent the script logs the composed message and exits 0 (graceful
fallback — the workflow step succeeds without posting).
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
HASH_FILE = REPO_ROOT / ".github" / "last-broadcast-hash"
DEMO_URL = "https://github.com/reliai/reliai-demo"

# ── Hook lines ─────────────────────────────────────────────────────────────
# Rotate via week_number % len(HOOKS). Technically credible, no hype language.
HOOKS: list[str] = [
    "What changed in Reliai this week:",
    "Latest in AI reliability debugging:",
    "New in Reliai's trace tooling:",
    "This week in AI observability:",
    "Updated in the Reliai demo:",
    "Reliai trace tooling update:",
    "New in production AI monitoring:",
    "What's new in AI incident detection:",
]

# ── Regex helpers ──────────────────────────────────────────────────────────
_WHATS_NEW_BULLET = re.compile(
    r"## What's New\n\n- \(\d{4}-\d{2}-\d{2}\) ([^\n]+)"
)
_FEATURED_EXAMPLE = re.compile(
    r"## Featured Example\n\n\*\*\[([^\]]+)\]"
)


def _extract_latest_bullet(readme: str) -> str | None:
    m = _WHATS_NEW_BULLET.search(readme)
    return m.group(1).strip() if m else None


def _extract_featured_example(readme: str) -> str | None:
    m = _FEATURED_EXAMPLE.search(readme)
    return m.group(1).strip() if m else None


def _compose_message(bullet: str, week_number: int) -> str:
    hook = HOOKS[week_number % len(HOOKS)]
    body = f"{hook}\n{bullet}\n\nRun locally in 60s: {DEMO_URL}"
    # Truncate bullet if needed to stay under 280 chars
    if len(body) > 280:
        max_bullet = 280 - len(hook) - len(DEMO_URL) - len("\n\nRun locally in 60s: ") - 2
        body = f"{hook}\n{bullet[:max_bullet].rstrip()}…\n\nRun locally in 60s: {DEMO_URL}"
    return body


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _read_last_hash() -> str | None:
    if HASH_FILE.exists():
        return HASH_FILE.read_text().strip() or None
    return None


def _write_hash(h: str) -> None:
    HASH_FILE.parent.mkdir(parents=True, exist_ok=True)
    HASH_FILE.write_text(h + "\n")


# ── Twitter OAuth 1.0a ─────────────────────────────────────────────────────

def _percent_encode(s: str) -> str:
    return urllib.parse.quote(str(s), safe="")


def _build_oauth_header(
    method: str,
    url: str,
    api_key: str,
    api_secret: str,
    access_token: str,
    access_token_secret: str,
) -> str:
    nonce = uuid.uuid4().hex
    timestamp = str(int(time.time()))

    oauth_params: dict[str, str] = {
        "oauth_consumer_key": api_key,
        "oauth_nonce": nonce,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": timestamp,
        "oauth_token": access_token,
        "oauth_version": "1.0",
    }

    # Signature base string: sort all params, percent-encode, join
    sorted_params = "&".join(
        f"{_percent_encode(k)}={_percent_encode(v)}"
        for k, v in sorted(oauth_params.items())
    )
    base_string = "&".join([
        method.upper(),
        _percent_encode(url),
        _percent_encode(sorted_params),
    ])

    signing_key = f"{_percent_encode(api_secret)}&{_percent_encode(access_token_secret)}"
    raw_sig = hmac.new(
        signing_key.encode(),
        base_string.encode(),
        hashlib.sha1,
    ).digest()
    signature = base64.b64encode(raw_sig).decode()

    oauth_params["oauth_signature"] = signature
    auth_parts = ", ".join(
        f'{_percent_encode(k)}="{_percent_encode(v)}"'
        for k, v in sorted(oauth_params.items())
    )
    return f"OAuth {auth_parts}"


def _post_tweet(text: str) -> bool:
    api_key = os.getenv("TWITTER_API_KEY", "")
    api_secret = os.getenv("TWITTER_API_SECRET", "")
    access_token = os.getenv("TWITTER_ACCESS_TOKEN", "")
    access_token_secret = os.getenv("TWITTER_ACCESS_TOKEN_SECRET", "")

    missing = [
        name for name, val in [
            ("TWITTER_API_KEY", api_key),
            ("TWITTER_API_SECRET", api_secret),
            ("TWITTER_ACCESS_TOKEN", access_token),
            ("TWITTER_ACCESS_TOKEN_SECRET", access_token_secret),
        ] if not val
    ]
    if missing:
        print(f"  Twitter secrets not set ({', '.join(missing)}) — skipping post.")
        return False

    url = "https://api.twitter.com/2/tweets"
    auth_header = _build_oauth_header(
        "POST", url, api_key, api_secret, access_token, access_token_secret
    )
    payload = json.dumps({"text": text}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": auth_header,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
            tweet_id = body.get("data", {}).get("id", "?")
            print(f"  posted tweet: https://twitter.com/i/web/status/{tweet_id}")
            return True
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode(errors="replace")
        print(f"  Twitter API error {exc.code}: {error_body}", file=sys.stderr)
        return False


# ── LinkedIn (optional) ────────────────────────────────────────────────────

def _post_linkedin(text: str) -> None:
    token = os.getenv("LINKEDIN_TOKEN", "")
    if not token:
        return  # silently skip if not configured

    # Requires: POST https://api.linkedin.com/v2/ugcPosts
    # Needs the author URN — read from LINKEDIN_AUTHOR_URN env or skip.
    author_urn = os.getenv("LINKEDIN_AUTHOR_URN", "")
    if not author_urn:
        print("  LINKEDIN_TOKEN set but LINKEDIN_AUTHOR_URN missing — skipping LinkedIn.")
        return

    url = "https://api.linkedin.com/v2/ugcPosts"
    payload = json.dumps({
        "author": author_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE",
            }
        },
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15):
            print("  posted to LinkedIn.")
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode(errors="replace")
        print(f"  LinkedIn API error {exc.code}: {error_body}", file=sys.stderr)


# ── Main ───────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Weekly broadcast to Twitter/X")
    parser.add_argument(
        "--readme",
        default=str(REPO_ROOT / "README.md"),
        help="Path to README.md (default: repo root README.md)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the composed message and exit without posting",
    )
    args = parser.parse_args()

    readme_path = Path(args.readme)
    if not readme_path.exists():
        print(f"README not found: {readme_path}", file=sys.stderr)
        return 1

    readme = readme_path.read_text(encoding="utf-8")
    bullet = _extract_latest_bullet(readme)
    if not bullet:
        print("Could not find a What's New entry in README — nothing to broadcast.")
        return 0

    week_number = date.today().isocalendar()[1]
    message = _compose_message(bullet, week_number)

    print(f"\nComposed message ({len(message)} chars):\n")
    print("─" * 60)
    print(message)
    print("─" * 60)

    if len(message) > 280:
        print(f"WARNING: message is {len(message)} chars (over 280 limit).", file=sys.stderr)

    if args.dry_run:
        print("\n--dry-run: not posting.")
        return 0

    # Duplicate check
    current_hash = _sha256(message)
    last_hash = _read_last_hash()
    if last_hash == current_hash:
        print("\nMessage hash matches last broadcast — already posted this content, skipping.")
        return 0

    # Post
    posted = _post_tweet(message)
    _post_linkedin(message)

    # Write hash regardless of post outcome so re-runs don't spam on API errors
    if posted:
        _write_hash(current_hash)
        print(f"\nHash written to {HASH_FILE.relative_to(REPO_ROOT)}")
    else:
        print("\nPost skipped or failed — hash not updated.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
