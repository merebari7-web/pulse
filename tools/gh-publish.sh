#!/usr/bin/env bash
# gh-publish.sh — push this repo to GitHub and turn on Pages (GitHub Actions source).
#
#   GH_TOKEN=github_pat_xxx ./tools/gh-publish.sh [owner]
#
# Deliberate properties, in order of how much they matter:
#   • the token is read from the environment and passed to git through a
#     throwaway GIT_ASKPASS script in $TMPDIR — it is never put in a remote URL,
#     never written to .git/config, never added to a credential helper, and the
#     askpass file is deleted on exit;
#   • it refuses to run without a token, and refuses to force-push over anything;
#   • the repo is created only if it does not exist; an existing repo is used
#     as-is and never renamed, archived or deleted;
#   • Pages is switched to `build_type: workflow` (the same as ticking
#     Settings → Pages → Source: GitHub Actions), then polled until `built`;
#   • `--check` verifies the token and the owner name and changes nothing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API="${GH_API:-https://api.github.com}"
REPO="${GH_REPO:-pulse}"
BRANCH="${GH_BRANCH:-main}"
MODE="publish"
OWNER="${1:-}"

if [[ "${1:-}" == "--check" ]]; then MODE="check"; OWNER="${2:-}"; fi

die() { echo "error: $*" >&2; exit 1; }

# the askpass helper below reads it from the environment git hands it
export GH_TOKEN
[[ -n "${GH_TOKEN:-}" ]] || die "GH_TOKEN is not set. Export a fine-grained PAT with Contents:read/write (and Administration:write only if the repo must be created, plus Pages:write to flip Pages on), then re-run. Revoke it afterwards."
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not a git work tree: $ROOT"
git diff --quiet HEAD || die "tracked files differ from HEAD — commit (or stash) first, so what you publish is what you tested"
# an untracked file that never gets committed is the classic “works on my machine,
# 404 on Pages” bug, so it is an error here rather than a silent omission
UNTRACKED="$(git ls-files --others --exclude-standard)"
if [[ -n "$UNTRACKED" && -z "${GH_ALLOW_UNTRACKED:-}" ]]; then
  printf '%s\n' "$UNTRACKED" | sed 's/^/   /' >&2
  die "untracked files above would be left out of the publish. git add them, or set GH_ALLOW_UNTRACKED=1 to publish without them."
fi

# ── token → api base, then the owner ──────────────────────────────────────────
api() { # api <method> <path> [json]
  local m="$1" p="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -X "$m" -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
      -H "Content-Type: application/json" -d "$body" -w '\n%{http_code}' "$API$p"
  else
    curl -sS -X "$m" -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
      -w '\n%{http_code}' "$API$p"
  fi
}
unpack() { local code="${1##*$'\n'}"; printf '%s' "${1%$'\n'*}"; printf '\n' >/dev/null; echo "$code" >&2; }

set +e
WHO_RAW="$(api GET /user)"; rc=$?
set -e
[[ $rc -eq 0 ]] || die "could not reach $API (offline?)"
WHO_CODE="${WHO_RAW##*$'\n'}"
WHO_JSON="${WHO_RAW%$'\n'*}"
[[ "$WHO_CODE" == "200" ]] || die "token rejected (HTTP $WHO_CODE). A fine-grained PAT has no /user access: pass the owner explicitly — ./tools/gh-publish.sh <owner>"

WHO_LOGIN="$(printf '%s' "$WHO_JSON" | sed -n 's/.*"login":"\([^"]*\)".*/\1/p' | head -1)"
if [[ -z "$OWNER" ]]; then
  OWNER="$WHO_LOGIN"
  [[ -n "$OWNER" ]] || die "could not derive the owner from the token; pass it: ./tools/gh-publish.sh <owner>"
fi
FULL="$OWNER/$REPO"
# GH_PUSH_URL exists for two reasons: GitHub Enterprise / a mirror remote, and
# so the script's whole flow can be exercised against a local bare repo.
SLUG_URL="${GH_PUSH_URL:-https://github.com/$FULL.git}"
echo "→ owner/repo : $FULL"
echo "→ branch     : $BRANCH   ($(git rev-parse --short HEAD) dirty=$( [[ -z $(git status --porcelain) ]] && echo no || echo yes ))"

if [[ "$MODE" == "check" ]]; then
  echo "→ token ok   : authenticated as ${WHO_LOGIN:-<fine-grained PAT>}"
  set +e
  REPO_RAW="$(api GET "/repos/$FULL")"; rc=$?
  set -e
  REPO_CODE="${REPO_RAW##*$'\n'}"
  if [[ "$REPO_CODE" == "200" ]]; then
    echo "→ repo       : exists"
    printf '%s' "${REPO_RAW%$'\n'*}" | sed -n 's/.*"default_branch":"\([^"]*\)".*/→ default   : \1/p'
  else
    echo "→ repo       : not found (HTTP $REPO_CODE) — publish would create it as a public repo"
  fi
  exit 0
fi

# ── authorship: the commit must be attributed to a real account ───────────────
if [[ -n "${GIT_AUTHOR_NAME:-}" && -n "${GIT_AUTHOR_EMAIL:-}" ]]; then
  echo "→ rewriting authorship on ${BRANCH} to $GIT_AUTHOR_NAME <$GIT_AUTHOR_EMAIL>"
  set +e
  GIT_COMMITTER_NAME="$GIT_AUTHOR_NAME" GIT_COMMITTER_EMAIL="$GIT_AUTHOR_EMAIL" \
  git -c "user.name=$GIT_AUTHOR_NAME" -c "user.email=$GIT_AUTHOR_EMAIL" \
    rebase -q --root --exec 'git commit --amend --no-edit --reset-author' 2>&1 | tail -3
  rc=$?
  set -e
  [[ $rc -eq 0 ]] || die "the authorship rebase failed — refusing to push a half-rewritten branch"
else
  echo "!  GIT_AUTHOR_NAME / GIT_AUTHOR_EMAIL unset — keeping the existing author"
fi

# ── create the repo if it is absent ───────────────────────────────────────────
set +e
EXIST="$(api GET "/repos/$FULL")"; rc=$?
set -e
if [[ "${EXIST##*$'\n'}" != "200" ]]; then
  echo "→ creating $FULL (public, Pages-ready)"
  BODY="$(printf '{"name":"%s","private":false,"has_issues":true,"has_wiki":false,"description":"%s"}' \
    "$REPO" "An interactive 3D field guide to the human heart — scroll-driven WebGL, React Three Fiber.")"
  set +e
  CREATED="$(api POST /user/repos "$BODY")"; rc=$?
  set -e
  CODE="${CREATED##*$'\n'}"
  [[ "$CODE" == "201" ]] || die "could not create the repo (HTTP $CODE): ${CREATED%$'\n'*}"
else
  echo "→ $FULL exists; pushing over it"
fi

# ── push, with the token only ever in an ephemeral askpass file ───────────────
ASKPASS="$(mktemp "${TMPDIR:-/tmp}/gh-askpass.XXXXXX")"
cleanup() { rm -f "$ASKPASS"; }
trap cleanup EXIT
cat > "$ASKPASS" <<EOF
#!/bin/sh
case "\$1" in
  *Username*) printf '%s\n' "x-access-token" ;;
  *)          printf '%s\n' "\$GH_TOKEN" ;;
esac
EOF
chmod 700 "$ASKPASS"

set +e
git -c "credential.helper=" -c "core.askPass=$ASKPASS" \
  push --porcelain "$SLUG_URL" "refs/heads/$BRANCH:refs/heads/$BRANCH" 2>&1 | sed "s/oauth2:[^@]*@/oauth2:‹redacted›@/g"
rc=${PIPESTATUS[0]}
set -e
[[ $rc -eq 0 ]] || die "git push failed (HTTP/auth). Run with --check first; if the repo is protected, push the branch and open a PR."
echo "→ pushed $BRANCH"

# ── Pages: GitHub Actions as the source ───────────────────────────────────────
test -f .github/workflows/pages.yml || echo "!  .github/workflows/pages.yml is missing — Pages would have nothing to build"
set +e
PG="$(api POST "/repos/$FULL/pages" '{"build_type":"workflow"}')"; rc=$?
set -e
CODE="${PG##*$'\n'}"
case "$CODE" in
  201|202|204) echo "→ Pages: build_type=workflow" ;;
  409|422)     echo "!  Pages already configured or needs the UI toggle (HTTP $CODE) — set Settings → Pages → Source: GitHub Actions" ;;
  *)           echo "!  Pages call returned HTTP $CODE — flip it in Settings → Pages (Source: GitHub Actions)" ;;
esac

for _ in 1 2 3 4 5 6; do
  sleep 5
  set +e
  ST="$(api GET "/repos/$FULL/pages")"; rc=$?
  set -e
  BODY="${ST%$'\n'*}"
  STATUS="$(printf '%s' "$BODY" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')"
  echo "→ pages status: ${STATUS:-unknown}"
  [[ "$STATUS" == "built" ]] && break
done

URL="$(printf '%s' "$BODY" | sed -n 's/.*"html_url":"\([^"]*\)".*/\1/p')"
echo
echo "  repo : https://github.com/$FULL"
echo "  site : ${URL:-https://$OWNER.github.io/$REPO/}"
echo
echo "  now revoke the token at https://github.com/settings/personal-access-tokens"
