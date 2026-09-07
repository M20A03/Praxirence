# Praxirence Patient Mobile App (React Native Expo)

The Praxirence Patient Mobile App is built using React Native and the Expo SDK. It provides patients with passwordless OTP login, real-time access to their consultation care plans, medication reminders, push notifications via Firebase Cloud Messaging, and plain-language consent management.

---

## 📱 Features

- **Passwordless OTP Login:** Enter your mobile phone number, receive a 6-digit verification code via Twilio Verify, and securely sign in without passwords.
- **Active Medications & Next Dose Card:** Large, high-contrast countdown card for your next scheduled medicine with a one-tap "Mark as Taken" action.
- **Past Consultation Care Plans:** Complete historical timeline of diagnoses, prescriptions, and doctor notes.
- **Digital Plain-Language Consent:** Read simple bullet points explaining data privacy, AES-256 encryption at rest, automatic audio destruction, and WhatsApp delivery, with instant Grant/Revoke toggle buttons.
- **Push Notifications:** Medication alerts scheduled through Firebase Cloud Messaging (FCM).

---

## 🚀 Quick Start (Development & Web Preview)

### Prerequisites
- Node.js v18+ and npm
- Expo CLI (`npm install -g expo-cli` or using `npx expo`)

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Start Expo Development Server
```bash
# Start the Expo bundler
npx expo start
```

### 3. Running on Devices
- **Physical Device:** Install the **Expo Go** app from the [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) or [Apple App Store](https://apps.apple.com/app/expo-go/id982107779). Scan the QR code displayed in your terminal.
- **Web Browser Preview:** Press `w` in the terminal to immediately open the app in your browser at `http://localhost:8081`.
- **Android Emulator:** Press `a` in the terminal.
- **iOS Simulator (macOS):** Press `i` in the terminal.

---

## 📦 Building Standalone APK / IPA via EAS Build

Expo Application Services (EAS) allows you to compile standalone APK/AAB files for Android and IPA files for iOS without needing Android Studio or Xcode installed locally.

### Step 1: Install EAS CLI
```bash
npm install -g eas-cli
```

### Step 2: Log In to Expo Account
```bash
eas login
```

### Step 3: Configure Project
```bash
eas build:configure
```

### Step 4: Build Standalone Android APK (Direct Device Installation)
To generate an installable `.apk` file directly:
```bash
eas build -p android --profile preview
```
Once the cloud build finishes (typically 3–5 minutes), EAS will provide a direct download link and QR code to install the APK directly on any Android phone.

### Step 5: Build Production Android App Bundle (.aab) for Google Play
```bash
eas build -p android --profile production
```

### Step 6: Build iOS IPA for TestFlight or Ad-Hoc
```bash
eas build -p ios --profile preview
```

---

## 🔄 Over-The-Air (OTA) Updates

To publish immediate bug fixes and UI updates to all installed apps without requiring users to download a new APK/IPA from the app stores:

```bash
eas update --branch production --message "Update care plan reminder format"
```

---

## ⚙️ Configuration & API Connection

The mobile app connects to the FastAPI backend at `http://localhost:8000` by default. When running on a physical phone via Expo Go:
1. Open `src/services/api.ts`.
2. Update `API_BASE_URL` to your computer's local Wi-Fi IP address (e.g. `http://192.168.1.50:8000`) so the phone can reach the backend.
