#!/usr/bin/env bash
# Quick Fill Auto-Updater (Linux/Mac)
# Run once — stays in background and auto-updates the extension
# Press Ctrl+C to stop

EXT_PATH="$(cd "$(dirname "$0")" && pwd)"
GIT_URL="https://raw.githubusercontent.com/Drakuu/Auto-Fill/main/version.json"
CHECK_INTERVAL=120

echo "Quick Fill Auto-Updater running..."
echo "Watching: $EXT_PATH"
echo "Checking every $CHECK_INTERVAL seconds"
echo ""

while true; do
    REMOTE_JSON=$(curl -s "$GIT_URL?t=$(date +%s)")
    REMOTE_VER=$(echo "$REMOTE_JSON" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)

    if [ -f "$EXT_PATH/version.json" ]; then
        LOCAL_VER=$(grep -o '"version":"[^"]*"' "$EXT_PATH/version.json" | cut -d'"' -f4)

        if [ "$REMOTE_VER" != "" ] && [ "$REMOTE_VER" != "$LOCAL_VER" ]; then
            echo "$(date +%H:%M:%S) Update detected: $LOCAL_VER -> $REMOTE_VER"

            cd "$EXT_PATH" && git pull

            # Update version.json with new version + pull timestamp
            echo "{\"version\":\"$REMOTE_VER\",\"lastPull\":$(date +%s)}" > "$EXT_PATH/version.json"

            echo "$(date +%H:%M:%S) Update applied! Extension will reload automatically."
        fi
    else
        echo "$REMOTE_JSON" > "$EXT_PATH/version.json"
        echo "$(date +%H:%M:%S) Initial version saved: $REMOTE_VER"
    fi

    sleep $CHECK_INTERVAL
done
