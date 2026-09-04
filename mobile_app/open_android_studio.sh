#!/usr/bin/env bash
# Praxirence Patient Android Studio Launcher
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_PROJECT_DIR="$SCRIPT_DIR/android"

echo "📱 Launching Android Studio for Praxirence Android Project..."
echo "📂 Project Path: $ANDROID_PROJECT_DIR"

if command -v android-studio &>/dev/null; then
    android-studio "$ANDROID_PROJECT_DIR" >/dev/null 2>&1 &
elif [ -f "/snap/bin/android-studio" ]; then
    /snap/bin/android-studio "$ANDROID_PROJECT_DIR" >/dev/null 2>&1 &
elif [ -f "/opt/android-studio/bin/studio.sh" ]; then
    /opt/android-studio/bin/studio.sh "$ANDROID_PROJECT_DIR" >/dev/null 2>&1 &
else
    echo "⚠️ Android Studio executable not found in PATH or standard directories."
    echo "You can open Android Studio manually and select: $ANDROID_PROJECT_DIR"
    exit 1
fi

echo "✅ Android Studio opened successfully."
