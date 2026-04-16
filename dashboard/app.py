# What it does:

# Shows live metrics, anomaly alerts, RCA, recovery logs.

# PPT Module:

# Real-time System View
import streamlit as st
import requests

st.title("Autonomous Recovery Dashboard")

telemetry = requests.get("http://localhost:8000/telemetry/collect").json()
anomaly = requests.get("http://localhost:8000/anomaly/detect").json()
rca = requests.get("http://localhost:8000/rca/analyze").json()

st.subheader("Live Metrics")
st.json(telemetry)

st.subheader("Anomaly Detection")
st.json(anomaly)

st.subheader("Root Cause Analysis")
st.json(rca)

if st.button("Trigger Recovery"):
    recovery = requests.post("http://localhost:8000/recovery/execute").json()
    st.subheader("Recovery Result")
    st.json(recovery)