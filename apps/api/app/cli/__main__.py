from __future__ import annotations

import argparse
import sys

from app.cli.admin import grant_system_admin, revoke_system_admin


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="reliai", description="Reliai administrative CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    admin_parser = subparsers.add_parser("admin", help="Admin management commands")
    admin_subparsers = admin_parser.add_subparsers(dest="admin_command", required=True)

    grant_parser = admin_subparsers.add_parser("grant", help="Grant system admin access")
    grant_parser.add_argument("--email", required=True)
    grant_parser.add_argument("--confirm", action="store_true")
    grant_parser.add_argument("--dry-run", action="store_true")
    grant_parser.add_argument("--reason")

    revoke_parser = admin_subparsers.add_parser("revoke", help="Revoke system admin access")
    revoke_parser.add_argument("--email", required=True)
    revoke_parser.add_argument("--confirm", action="store_true")
    revoke_parser.add_argument("--dry-run", action="store_true")
    revoke_parser.add_argument("--reason")

    return parser


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "admin":
        if args.admin_command == "grant":
            grant_system_admin(
                args.email,
                confirm=args.confirm,
                dry_run=args.dry_run,
                reason=args.reason,
            )
            return
        if args.admin_command == "revoke":
            revoke_system_admin(
                args.email,
                confirm=args.confirm,
                dry_run=args.dry_run,
                reason=args.reason,
            )
            return

    parser.print_help()
    sys.exit(1)


if __name__ == "__main__":
    main()
