#!/usr/bin/env bash
# Fetch AWS SSM parameters under a path, with pagination, and optionally write a dotenv file or export to shell
# Usage:
#   ./scripts/get-ssm.sh <ssm_path> [--region ap-southeast-2] [--out .env.local] [--export]

set -euo pipefail

SSM_PATH="${1:-}"
shift || true

REGION="ap-southeast-2"
OUT_FILE=""
DO_EXPORT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region)
      REGION="${2:-ap-southeast-2}"; shift 2 ;;
    --out)
      OUT_FILE="${2:-}"; shift 2 ;;
    --export)
      DO_EXPORT=true; shift ;;
    *)
      echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$SSM_PATH" ]]; then
  echo "Usage: $0 <SSM_PARAMETER_PATH> [--region ap-southeast-2] [--out .env.local] [--export]" >&2
  exit 1
fi

# Ensure path begins with '/'
if [[ "$SSM_PATH" != /* ]]; then
  SSM_PATH="/$SSM_PATH"
fi

# Warn if using reserved prefixes
case "$SSM_PATH" in
  /aws*|/ssm*)
    echo "Error: SSM path must not start with /aws or /ssm (reserved by AWS). Got: $SSM_PATH" >&2
    exit 1
    ;;
esac

# Paginate through SSM parameters
NEXT_TOKEN=""
PARAMS_JSON='{"Parameters":[]}'
while :; do
  if [[ -n "$NEXT_TOKEN" ]]; then
    PAGE=$(aws ssm get-parameters-by-path \
      --region "$REGION" \
      --path "$SSM_PATH" \
      --recursive --with-decryption \
      --max-items 10 \
      --starting-token "$NEXT_TOKEN")
  else
    PAGE=$(aws ssm get-parameters-by-path \
      --region "$REGION" \
      --path "$SSM_PATH" \
      --recursive --with-decryption \
      --max-items 10)
  fi

  # Merge pages
  PARAMS_JSON=$(jq -sc 'reduce .[] as $p ({Parameters: []}; {Parameters: (.Parameters + $p.Parameters)})' \
    <(echo "$PARAMS_JSON") <(echo "$PAGE"))

  NEXT_TOKEN=$(echo "$PAGE" | jq -r '.NextToken // empty')
  [[ -z "$NEXT_TOKEN" ]] && break
done

# Convert to dotenv lines: strip prefix path, upper-case keys, replace non-alnum with underscore
PREFIX_ESCAPED=$(printf '%s' "$SSM_PATH/" | sed 's/[^^]/[&]/g; s/\^/\\^/g')
DOTENV=$(echo "$PARAMS_JSON" | jq -r --arg prefix "$SSM_PATH/" '
  .Parameters[] | {Name, Value} |
  .Name |= (sub("^" + ($prefix|@json|fromjson); "")) |
  .Name |= ascii_upcase |
  .Name |= gsub("[^A-Z0-9_]+"; "_") |
  .Name + "=" + (.Value|tostring)
')

if [[ -n "$OUT_FILE" ]]; then
  echo "# Generated from SSM path: $SSM_PATH (region: $REGION) on $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$OUT_FILE"
  printf '%s
' "$DOTENV" >> "$OUT_FILE"
  echo "Wrote $OUT_FILE" >&2
fi

if $DO_EXPORT; then
  # Print export statements to stdout for eval
  echo "$DOTENV" | while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    key="${line%%=*}"; val="${line#*=}"
    # Escape single quotes in value for safe eval
    val_esc=$(printf %s "$val" | sed "s/'/'\\''/g")
    printf "export %s='%s'\n" "$key" "$val_esc"
  done
else
  # Pretty-print JSON summary and dotenv preview
  echo "$PARAMS_JSON" | jq '. | {count: (.Parameters|length)}' >&2
  printf '%s\n' "$DOTENV"
fi
