# Kafka Setup For PipelineIQ

This project expects Kafka at:

```env
KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_PIPELINE_EVENTS_TOPIC=pipeline-events
KAFKA_DIAGNOSIS_REQUIRED_TOPIC=diagnosis-required
```

If Kafka is not running, the backend will fail to start unless you disable Kafka in `.env`.

## Quickest Option: Use Docker

If you already have Docker installed, this is the easiest local setup.

## 1. Start Kafka in Docker

Run:

```bash
docker run -d --name pipelineiq-kafka \
  -p 9092:9092 \
  -e KAFKA_NODE_ID=1 \
  -e KAFKA_PROCESS_ROLES=broker,controller \
  -e KAFKA_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
  -e KAFKA_CONTROLLER_LISTENER_NAMES=CONTROLLER \
  -e KAFKA_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT \
  -e KAFKA_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  -e KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1 \
  -e KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1 \
  -e KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0 \
  -e KAFKA_NUM_PARTITIONS=3 \
  apache/kafka:3.9.0
```

This starts a single-node Kafka broker in KRaft mode and exposes it on `localhost:9092`.

## 2. Verify Kafka is running

Check the container:

```bash
docker ps
```

You should see `pipelineiq-kafka` running.

Then check logs:

```bash
docker logs -f pipelineiq-kafka
```

When Kafka is ready, the logs should stop showing startup errors.

Press `Ctrl+C` to stop following logs.

## 3. Create the topics

Create the topics your app uses:

```bash
docker exec -it pipelineiq-kafka /opt/kafka/bin/kafka-topics.sh \
  --create \
  --topic pipeline-events \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1
```

```bash
docker exec -it pipelineiq-kafka /opt/kafka/bin/kafka-topics.sh \
  --create \
  --topic diagnosis-required \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1
```

List topics to confirm:

```bash
docker exec -it pipelineiq-kafka /opt/kafka/bin/kafka-topics.sh \
  --list \
  --bootstrap-server localhost:9092
```

You should see:

- `pipeline-events`
- `diagnosis-required`

## 4. Match your `.env`

Make sure your root `.env` has:

```env
KAFKA_ENABLED=true
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_PIPELINE_EVENTS_TOPIC=pipeline-events
KAFKA_DIAGNOSIS_REQUIRED_TOPIC=diagnosis-required
KAFKA_MONITOR_GROUP_ID=pipelineiq-monitor-agent
KAFKA_DIAGNOSIS_GROUP_ID=pipelineiq-diagnosis-agent
```

## 5. Start the backend

From the repo root:

```bash
cd pipelineIQ
source .venv/bin/activate
uvicorn main:app --reload
```

If Kafka is reachable, the backend should start without the `Connection refused` error on `localhost:9092`.

## 6. Test Kafka manually

You can produce a test message:

```bash
docker exec -it pipelineiq-kafka /opt/kafka/bin/kafka-console-producer.sh \
  --topic pipeline-events \
  --bootstrap-server localhost:9092
```

Type a line like:

```text
{"hello":"world"}
```

Then press `Enter`.

To consume messages:

```bash
docker exec -it pipelineiq-kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --topic pipeline-events \
  --bootstrap-server localhost:9092 \
  --from-beginning
```

## 7. Stop Kafka

To stop the container:

```bash
docker stop pipelineiq-kafka
```

To start it again later:

```bash
docker start pipelineiq-kafka
```

To remove it completely:

```bash
docker rm -f pipelineiq-kafka
```

## If You Do Not Want Kafka Right Now

If you want the app to run without Kafka for local development, change your `.env` to:

```env
KAFKA_ENABLED=false
```

That lets you continue working on the rest of the app without a broker.

## Common Errors

### 1. `Unable to connect to localhost:9092`

Reason:
- Kafka is not running
- Kafka is running on a different port
- Docker container failed to start

Fix:
- run `docker ps`
- check `docker logs -f pipelineiq-kafka`
- confirm `.env` says `localhost:9092`

### 2. Topic does not exist

Reason:
- Kafka started, but topics were never created

Fix:
- run the `kafka-topics.sh --create` commands above

### 3. Docker command not found

Reason:
- Docker is not installed

Fix:
- install Docker first
- or temporarily use `KAFKA_ENABLED=false`

## Recommended Local Flow

1. Start Kafka container
2. Create topics
3. Confirm `localhost:9092` is reachable
4. Start backend
5. Start frontend
6. Trigger a webhook event and confirm it flows into:
   - `pipeline-events`
   - monitor agent
   - `diagnosis-required`
   - diagnosis report in the repository dashboard
