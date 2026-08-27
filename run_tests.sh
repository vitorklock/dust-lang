#!/usr/bin/env bash
# Runs the mandatory suite; cases 03-05 are expected to fail with the transpiler's own message.
for t in tests/0*.dust; do
  echo "===== $t ====="
  node dist/index.js "$t"
  echo
done
