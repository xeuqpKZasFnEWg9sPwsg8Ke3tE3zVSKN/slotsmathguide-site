#!/usr/bin/env bash
set -e
cd ~/.openclaw/workspace/slotsmathguide-site
git add .
if ! git diff --cached --quiet; then
  git commit -m "Autonomous site improvement"
  git push origin main
fi
