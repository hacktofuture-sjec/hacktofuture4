#include <WiFi.h>
#include <Wire.h>
#include <MPU6050.h>
#include "DHT.h"
#include <Firebase_ESP_Client.h>

// Firebase helpers
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// WiFi
#define WIFI_SSID "Motorola"
#define WIFI_PASSWORD "1234567890"

// Firebase
#define API_KEY "AIzaSyCnvkqxTZ4LaDkCkI7dc8BvKcZx4usRgoc"
#define DATABASE_URL "https://hack2future-79802-default-rtdb.firebaseio.com/"
#define USER_EMAIL "snvineeth10@gmail.com"
#define USER_PASSWORD "12345678"

// Firebase objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Sensors
MPU6050 mpu;

#define DHTPIN 27
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// Pins
#define GAS_PIN 34
#define PIR_PIN 33
#define BUZZER 25
#define LED 26

// Thresholds
float accThreshold = 0.25;
int gasThreshold = 2000;

// Earthquake persistence
unsigned long earthquakeStart = 0;
int earthquakeDuration = 10000;

// Timing
unsigned long sendTimer = 0;
unsigned long blinkTimer = 0;
bool ledState = false;

void setup() {
  Serial.begin(115200);

  pinMode(PIR_PIN, INPUT);
  pinMode(BUZZER, OUTPUT);
  pinMode(LED, OUTPUT);

  Wire.begin(21, 22);
  mpu.initialize();
  dht.begin();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void loop() {

  // ---- MPU ----
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);
  float acc = sqrt(ax*ax + ay*ay + az*az) / 16384.0;

  // ---- Sensors ----
  int gasValue = analogRead(GAS_PIN);
  int motion = digitalRead(PIR_PIN);

  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  if (isnan(temp)) temp = 0;
  if (isnan(hum)) hum = 0;

  // ---- Earthquake ----
  bool quake = abs(acc - 1.0) > accThreshold;

  if (quake) {
    earthquakeStart = millis();
  }

  bool earthquakeActive = (millis() - earthquakeStart <= earthquakeDuration);

  // ---- Alerts ----
  const char* alert = "SAFE";
  const char* subAlert = "";

  if (earthquakeActive) {
    alert = "EARTHQUAKE";
  }
  else if (gasValue > gasThreshold) {
    alert = "GAS LEAK";
  }

  if (earthquakeActive && motion == HIGH) {
    subAlert = "SURVIVOR";
  }

  // ---- BUZZER + LED LOGIC ----
  if (strcmp(alert, "EARTHQUAKE") == 0 || strcmp(alert, "GAS LEAK") == 0) {
    digitalWrite(BUZZER, HIGH);
    digitalWrite(LED, HIGH);
  }
  else if (strcmp(subAlert, "SURVIVOR") == 0) {
    // Blink LED + beep buzzer
    if (millis() - blinkTimer > 300) {
      blinkTimer = millis();
      ledState = !ledState;
      digitalWrite(LED, ledState);
      digitalWrite(BUZZER, ledState);
    }
  }
  else {
    digitalWrite(BUZZER, LOW);
    digitalWrite(LED, LOW);
  }

  // ---- Firebase ----
  if (Firebase.ready() && WiFi.status() == WL_CONNECTED &&
      millis() - sendTimer > 5000) {

    sendTimer = millis();

    FirebaseJson json;

    json.set("alert", alert);
    json.set("subAlert", subAlert);
    json.set("temperature", temp);
    json.set("humidity", hum);
    json.set("gas", gasValue);
    json.set("acceleration", acc);
    json.set("motion", motion);
    json.set("timestamp", millis());

    if (Firebase.RTDB.setJSON(&fbdo, "/node1", &json)) {
      Serial.println("✅ Data sent to Firebase");
    } else {
      Serial.println("❌ Error: " + fbdo.errorReason());
    }
  }

  delay(200);
}