#!/usr/bin/env bash
# Apply a checked-in migration to production.
#
#   supabase/apply.sh cohosts-2026-09-29
#   supabase/apply.sh cohosts-2026-09-29.rehearsal
#
# Exists because the command this replaces could not survive being pasted into
# a terminal: it spanned several lines, and the wrapped remnants ran as their
# own commands. It also put the database password on screen.
#
# SUPABASE_DB_URL in .env.local names the pooler, which is region-stamped and
# fails with a misleading `ENOTFOUND tenant/user`. We keep only the password
# from it and rebuild the direct host, which is IPv6-only and works from here.
set -euo pipefail

cd "$(dirname "$0")/.."

name="${1:-}"
[ -n "$name" ] || { echo "usage: supabase/apply.sh <migration-name-without-.sql>" >&2; exit 2; }

file="supabase/${name%.sql}.sql"
[ -f "$file" ] || { echo "no such migration: $file" >&2; exit 2; }

env_line() { grep "^$1=" .env.local | cut -d= -f2- | tr -d '"'; }

pooler="$(env_line SUPABASE_DB_URL)"
[ -n "$pooler" ] || { echo "SUPABASE_DB_URL missing from .env.local" >&2; exit 1; }

creds="${pooler#*://}"; creds="${creds%%@*}"
pw="${creds#*:}"

ref="$(env_line NEXT_PUBLIC_SUPABASE_URL)"
ref="${ref#https://}"; ref="${ref%%.supabase.co*}"
[ -n "$ref" ] || { echo "could not read the project ref from NEXT_PUBLIC_SUPABASE_URL" >&2; exit 1; }

psql=/opt/homebrew/opt/libpq/bin/psql
[ -x "$psql" ] || { echo "$psql not found (brew install libpq)" >&2; exit 1; }

echo "applying $file to $ref"
PGPASSWORD="$pw" "$psql" \
  "postgresql://postgres@db.${ref}.supabase.co:5432/postgres" \
  -v ON_ERROR_STOP=1 -f "$file"
echo "done: $file"
