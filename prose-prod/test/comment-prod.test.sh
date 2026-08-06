#!/usr/bin/env bash
# Regression gate for comment-prod's per-language marker detection.
set -uo pipefail

BIN="$(cd "$(dirname "$0")/../.." && pwd)/bin/comment-prod"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

# expect_clean <name> <filename> <<<content
expect_clean() {
  local name="$1" file="$TMP/$2"
  cat > "$file"
  if "$BIN" --file "$file" >/dev/null 2>&1; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    echo "FAIL (expected clean): $name"
    "$BIN" --file "$file"
  fi
}

expect_violation() {
  local name="$1" file="$TMP/$2"
  cat > "$file"
  if "$BIN" --file "$file" >/dev/null 2>&1; then
    fail=$((fail + 1))
    echo "FAIL (expected violation): $name"
  else
    pass=$((pass + 1))
  fi
}

expect_clean "ts private fields are not comments" p.ts <<'EOF'
export class Element extends HTMLElement {
  #root = null;
  #text = "";
  #refractor = undefined;
  #widgets = undefined;
}
EOF

expect_clean "css custom properties are not comments" p.css <<'EOF'
.diff {
  --pd-bg: #0d1117;
  --pd-fg: #c9d1d9;
  --pd-line: #21262d;
  --pd-head: #161b22;
}
EOF

expect_clean "css id and class selectors are not comments" q.css <<'EOF'
#app { color: red }
#main { color: blue }
#side { color: green }
EOF

expect_clean "ts hash imports and private methods" r.ts <<'EOF'
class A {
  #a() {}
  #b() {}
  #c() {}
  #d() {}
}
EOF

expect_violation "ts still catches four slash-slash lines" v.ts <<'EOF'
// one
// two
// three
// four
const a = 1;
EOF

expect_violation "css still catches a long block comment" v.css <<'EOF'
/* one
 * two
 * three
 * four
 */
.a { color: red }
EOF

expect_violation "shell still catches four hash lines" v.sh <<'EOF'
# one
# two
# three
# four
echo hi
EOF

expect_violation "sql still catches four dash lines" v.sql <<'EOF'
-- one
-- two
-- three
-- four
SELECT 1;
EOF

expect_clean "waiver still passes" w.ts <<'EOF'
// @comment-ok: documented protocol quirk
// one
// two
// three
const a = 1;
EOF

echo
echo "pass $pass, fail $fail"
[ "$fail" -eq 0 ]
