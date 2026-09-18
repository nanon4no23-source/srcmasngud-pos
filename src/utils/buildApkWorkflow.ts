// src/utils/buildApkWorkflow.ts
// Berkas alur kerja GitHub Actions untuk kompilasi otomatis Android APK (Capacitor)

export const BUILD_APK_YML_CONTENT = `name: Build Android APK (SRC MASNGUD)

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build:
    name: Build Android APK
    runs-on: ubuntu-latest

    steps:
      - name: 📥 Checkout Kode Repositori
        uses: actions/checkout@v4

      - name: 📦 Ekstrak Berkas ZIP (Jika Ada di Repositori)
        run: |
          echo "=== MEMERIKSA BERKAS DI REPOSITORI ==="
          ls -la
          # Ekstrak semua file zip yang ada untuk memastikan kode & aset terbaru terpasang
          for z in $(find . -maxdepth 3 -name "*.zip" -not -path "*/node_modules/*"); do
            if [ -f "$z" ]; then
              echo "Mengekstrak berkas $z..."
              unzip -q -o "$z" || true
            fi
          done
          # Bersihkan file zip cadangan dari assets android agar tidak membebani kompilasi
          find . -path "*/assets/public/*.zip" -delete 2>/dev/null || true
          echo "=== STRUKTUR SETELAH PEMERIKSAAN ==="
          ls -la

      - name: 🔍 Deteksi Lokasi Proyek (Root atau Subfolder)
        id: locate-project
        run: |
          GRADLEW_PATH=$(find . -maxdepth 4 -name "gradlew" -not -path "*/node_modules/*" | head -n 1)
          if [ -n "$GRADLEW_PATH" ]; then
            ANDROID_DIR=$(dirname "$GRADLEW_PATH")
            WORKDIR=$(dirname "$ANDROID_DIR")
            echo "workdir=$WORKDIR" >> $GITHUB_OUTPUT
            echo "Folder proyek ditemukan di: $WORKDIR (android ada di: $ANDROID_DIR)"
          else
            echo "workdir=." >> $GITHUB_OUTPUT
            echo "Menggunakan direktori root (.)"
          fi

      - name: 🟢 Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: ☕ Setup Java JDK 21 (Temurin)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '21'

      - name: 🤖 Setup Android SDK (API 35 & 34)
        uses: android-actions/setup-android@v3
        with:
          packages: 'platforms;android-35 platforms;android-34 build-tools;35.0.0 build-tools;34.0.0'

      - name: 📜 Setujui Lisensi Android SDK
        run: |
          yes | sdkmanager --licenses || true

      - name: ⚙️ Optimasi Konfigurasi Gradle
        run: |
          mkdir -p ~/.gradle
          echo "org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8" >> ~/.gradle/gradle.properties
          echo "android.useAndroidX=true" >> ~/.gradle/gradle.properties
          echo "android.builder.sdkDownload=true" >> ~/.gradle/gradle.properties

      - name: 🔧 Auto-Patch Kompatibilitas Kode & Duplicate Classes
        working-directory: \${{ steps.locate-project.outputs.workdir }}
        run: |
          echo "=== MENYELARASKAN FILE GRADLE KE JAVA 21 & SDK 35 ==="
          # 1. Pastikan semua file gradle menggunakan Java 21
          find android/ -type f -name "*.gradle" -not -path "*/build/*" -exec sed -i 's/JavaVersion\\.VERSION_1_8/JavaVersion.VERSION_21/g' {} +
          find android/ -type f -name "*.gradle" -not -path "*/build/*" -exec sed -i 's/JavaVersion\\.VERSION_17/JavaVersion.VERSION_21/g' {} +
          
          # 2. Pastikan compileSdkVersion dan targetSdkVersion diselaraskan ke 35
          find android/ -type f -name "variables.gradle" -exec sed -i 's/compileSdkVersion = [0-9]\\+/compileSdkVersion = 35/g' {} +
          find android/ -type f -name "variables.gradle" -exec sed -i 's/targetSdkVersion = [0-9]\\+/targetSdkVersion = 35/g' {} +
          
          # 3. Ganti VANILLA_ICE_CREAM dengan nilai konstan 35 untuk kompatibilitas lintas SDK
          find android/ -type f -name "*.java" -not -path "*/build/*" -exec sed -i 's/Build\\.VERSION_CODES\\.VANILLA_ICE_CREAM/35/g' {} +
          
          # 4. Perbaiki potensi error pemanggilan onBackPressed()
          find android/ -type f -name "MainActivity.java" -exec sed -i 's/MainActivity\\.super\\.onBackPressed();/finish();/g' {} +
          
          # 5. Hilangkan error duplicate class Kotlin (kotlin-stdlib-jdk7 dan kotlin-stdlib-jdk8)
          python3 -c '
          import glob
          for f in glob.glob("android/**/build.gradle", recursive=True):
              with open(f, "r", encoding="utf-8") as file:
                  c = file.read()
              if "kotlin-stdlib-jdk7" not in c:
                  c += "\\nconfigurations.all {\\n    exclude group: \\"org.jetbrains.kotlin\\", module: \\"kotlin-stdlib-jdk7\\"\\n    exclude group: \\"org.jetbrains.kotlin\\", module: \\"kotlin-stdlib-jdk8\\"\\n}\\n"
                  with open(f, "w", encoding="utf-8") as file:
                      file.write(c)
                  print("Patched duplicate kotlin exclusion in:", f)
          '

          # 6. Cegah crash google-services jika file google-services.json tidak ada
          if [ ! -f "android/app/google-services.json" ]; then
            find android/app/ -name "build.gradle" -exec sed -i '/apply plugin:.*google-services.*/d' {} +
          fi

          echo "=== HASIL PEMERIKSAAN FILE GRADLE ==="
          grep -rn "sourceCompatibility" android/ || true
          grep -rn "compileSdkVersion" android/ || true

      - name: 📦 Install Node Dependencies
        working-directory: \${{ steps.locate-project.outputs.workdir }}
        run: |
          npm install --legacy-peer-deps --no-audit || npm install --force || true

      - name: 🌐 Build Web App & Sync ke Android
        working-directory: \${{ steps.locate-project.outputs.workdir }}
        run: |
          npm run build || echo "⚠️ Build Vite dilewati"
          if [ -d "dist" ]; then
            mkdir -p android/app/src/main/assets/public
            cp -rf dist/* android/app/src/main/assets/public/
            npx cap copy android || true
          fi
          # Pastikan tidak ada file zip cadangan di dalam folder aset android
          find android/ -path "*/assets/public/*.zip" -delete 2>/dev/null || true

      - name: 🔑 Berikan Izin Eksekusi Gradle Wrapper
        working-directory: \${{ steps.locate-project.outputs.workdir }}
        run: |
          chmod +x ./android/gradlew || true

      - name: 🔨 Compile & Build APK Android
        working-directory: \${{ steps.locate-project.outputs.workdir }}
        run: |
          cd android
          chmod +x ./gradlew
          # Build APK Debug (paling stabil & langsung bisa di-install di HP Android)
          ./gradlew assembleDebug --no-daemon --console=plain
          # Build APK Release jika diinginkan
          ./gradlew assembleRelease --no-daemon --console=plain || true

      - name: 📂 Kumpulkan & Gandakan File APK
        working-directory: \${{ steps.locate-project.outputs.workdir }}
        run: |
          mkdir -p output-apk
          find android/app/build/outputs/apk/ -name "*.apk" -exec cp {} output-apk/ \; || true
          echo "=== BERKAS APK HASIL BUILD ==="
          ls -lh output-apk/

      - name: 🚀 Unggah File APK ke Artifacts GitHub
        uses: actions/upload-artifact@v4
        with:
          name: srcmasngud-kasir-apk
          path: \${{ steps.locate-project.outputs.workdir }}/output-apk/*
          retention-days: 30
`;
