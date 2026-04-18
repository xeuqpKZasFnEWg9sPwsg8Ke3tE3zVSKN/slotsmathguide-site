#!/usr/bin/env bash
set -e
cd ~/.openclaw/workspace/slotsmathguide-site

git add .
if ! git diff --cached --quiet; then
  git commit -m "Autonomous site improvement"
  git push origin main

  if [ -f .agent/LAST_DONE.md ]; then
    MSG="$(tr '\n' ' ' < .agent/LAST_DONE.md | sed 's/  */ /g' | cut -c1-800)"
    openclaw message send \
      --channel telegram \
      --target 689279542 \
      --message "Deployment done. ${MSG}"
  else
    openclaw message send \
      --channel telegram \
      --target 689279542 \
      --message "Deployment done."
  fi
fi
