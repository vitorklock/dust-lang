#!/usr/bin/env bash
# Roda a suíte obrigatória; casos 03-05 devem falhar com a mensagem do transpilador.
for t in tests/0*.dust; do
  echo "===== $t ====="
  node dist/index.js "$t"
  echo
done
