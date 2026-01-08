# Confluent Cloud Setup Guide

This guide walks you through setting up your Spring Boot application with Confluent Cloud.

## Prerequisites

- Java 21
- Maven 3.x
- A Confluent Cloud account (free tier available)

## Step 1: Create a Confluent Cloud Account

1. Go to https://confluent.cloud
2. Sign up for a free account
3. You'll get $400 in free credits (valid for 30 days)

## Step 2: Create a Kafka Cluster

1. **Log in** to Confluent Cloud Console
2. **Create a new cluster:**
   - Click "Create cluster"
   - Choose cluster type:
     - **Basic** (Recommended for development) - Single zone, economical
     - **Standard** - Multi-zone for higher availability
     - **Dedicated** - For production workloads

3. **Select cloud provider and region:**
   - Choose AWS, GCP, or Azure
   - Select a region close to your application

4. **Name your cluster** (e.g., "dev-cluster")
5. **Launch the cluster** - This takes 5-10 minutes

## Step 3: Get Your Cluster Bootstrap Server

1. In Confluent Cloud Console, go to your cluster
2. Click **"Cluster overview"** or **"Cluster settings"**
3. Copy the **Bootstrap server** URL
   - Example: `pkc-xxxxx.us-east-1.aws.confluent.cloud:9092`
4. Save this value for your `.env` file

## Step 4: Create API Keys for Kafka

1. In your cluster, go to **"API Keys"** (left sidebar or under Data Integration)
2. Click **"Add key"**
3. Choose **"Global access"** or scope to specific topics
4. Click **"Next"** and **"Create"**
5. **IMPORTANT:** Copy and save both:
   - **API Key** (username)
   - **API Secret** (password)

   ⚠️ **You cannot retrieve the secret later!**

## Step 5: Create Topics

1. In your cluster, go to **"Topics"** in the left sidebar
2. Click **"Create topic"**
3. Create two topics:
   - **messages-topic**
     - Partitions: 3
     - Retention: 7 days (or as needed)
   - **events-topic**
     - Partitions: 3
     - Retention: 7 days (or as needed)
4. Click **"Create"** for each topic

## Step 6: (Optional) Set Up Schema Registry

If you plan to use Avro serialization:

1. Go to **"Schema Registry"** in the left sidebar
2. Click **"Set up on my own"** or select a cloud provider/region
3. Copy the **Schema Registry URL**
   - Example: `https://psrc-xxxxx.us-east-2.aws.confluent.cloud`
4. Click **"API credentials"** or **"Create API key"**
5. Copy the **API Key** and **API Secret**

## Step 7: Configure Your Application

### 1. Copy the environment file

```bash
cp .env.example .env
```

### 2. Edit `.env` with your credentials

```bash
# From Step 3
KAFKA_BOOTSTRAP_SERVERS=pkc-xxxxx.us-east-1.aws.confluent.cloud:9092

# From Step 4
KAFKA_API_KEY=YOUR_KAFKA_API_KEY
KAFKA_API_SECRET=YOUR_KAFKA_API_SECRET

# From Step 6 (Optional)
SCHEMA_REGISTRY_URL=https://psrc-xxxxx.us-east-2.aws.confluent.cloud
SCHEMA_REGISTRY_API_KEY=YOUR_SR_API_KEY
SCHEMA_REGISTRY_API_SECRET=YOUR_SR_API_SECRET

# Consumer group
KAFKA_CONSUMER_GROUP_ID=stream-consumer-group
```

### 3. Load environment variables

**Option A: Using direnv (Recommended)**

```bash
# Install direnv
# Ubuntu/Debian
sudo apt-get install direnv

# macOS
brew install direnv

# Add to your shell profile
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc  # or ~/.zshrc

# Allow direnv in this directory
direnv allow
```

**Option B: Export manually**

```bash
export $(cat .env | xargs)
```

**Option C: Use Spring Boot Maven plugin**

```bash
./mvnw spring-boot:run -Dspring-boot.run.arguments="--spring.profiles.active=cloud"
```

And pass environment variables when running.

## Step 8: Update Maven Run Configuration

Create a `.mvn/jvm.config` file (optional):

```
-DKAFKA_BOOTSTRAP_SERVERS=${KAFKA_BOOTSTRAP_SERVERS}
-DKAFKA_API_KEY=${KAFKA_API_KEY}
-DKAFKA_API_SECRET=${KAFKA_API_SECRET}
```

Or run with profile:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=cloud
```

## Step 9: Run Your Application

```bash
# Make sure environment variables are set
./mvnw spring-boot:run -Dspring-boot.run.profiles=cloud
```

Or if using direnv:

```bash
./mvnw spring-boot:run
```

## Step 10: Test the Connection

### Send a test message

```bash
curl -X POST http://localhost:8080/api/kafka/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello from Confluent Cloud!",
    "sender": "Test User"
  }'
```

### Verify in Confluent Cloud Console

1. Go to **"Topics"** in your cluster
2. Click on **"messages-topic"**
3. Click **"Messages"** tab
4. You should see your message

## Monitoring in Confluent Cloud

### View Messages

1. **Topics** → Select topic → **Messages** tab
2. Browse messages by partition and offset
3. View message keys, values, headers, and timestamps

### Monitor Consumer Groups

1. **Consumers** → Select your consumer group
2. View lag, offset positions, and consumption rate
3. Monitor consumer health and performance

### Check Cluster Metrics

1. **Cluster Overview** → **Metrics**
2. View throughput, storage, and partition metrics
3. Set up alerts for important events

## Cost Management

### Free Tier Limits

- $400 in free credits (30 days)
- After credits expire, you'll be charged based on usage

### Monitor Usage

1. Go to **"Billing & payment"** in the top right
2. View current usage and costs
3. Set up billing alerts

### Cost Optimization Tips

- Use **Basic cluster** for development
- Delete unused topics
- Reduce retention time for development topics
- Stop/delete clusters when not in use
- Use shorter retention periods (1-7 days for dev)

## Troubleshooting

### Connection Issues

**Error: "Authentication failed"**
- Verify API key and secret are correct
- Check if API key has proper permissions
- Ensure no extra spaces in `.env` file

**Error: "Connection timeout"**
- Verify bootstrap server URL is correct
- Check your network/firewall settings
- Confirm cluster is running in Confluent Cloud Console

### Topics Not Found

- Verify topics exist in Confluent Cloud Console
- Check topic names match exactly (case-sensitive)
- Ensure API key has access to the topics

### Messages Not Being Consumed

- Check consumer group in Confluent Cloud Console
- Verify consumer is running and connected
- Check offset positions and lag
- Look for deserialization errors in logs

### Schema Registry Issues

- Verify Schema Registry URL is correct
- Check Schema Registry API credentials
- Ensure schema compatibility settings are correct

## Security Best Practices

1. **Never commit `.env` file** - It's in `.gitignore`
2. **Rotate API keys regularly**
3. **Use separate keys for dev/prod**
4. **Scope API keys** to specific topics when possible
5. **Enable audit logging** in production
6. **Use service accounts** for production applications

## Switching Between Local and Cloud

### Use Local Kafka (Docker)

```bash
# Don't set the cloud profile
./mvnw spring-boot:run
```

Or explicitly:

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=default
```

### Use Confluent Cloud

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=cloud
```

## Additional Resources

- [Confluent Cloud Documentation](https://docs.confluent.io/cloud/current/overview.html)
- [Confluent Cloud Quickstart](https://docs.confluent.io/cloud/current/get-started/index.html)
- [Spring Kafka with Confluent Cloud](https://docs.confluent.io/kafka-clients/java/current/overview.html)
- [Confluent Cloud Pricing](https://www.confluent.io/confluent-cloud/pricing/)

## Support

- [Confluent Community Forum](https://forum.confluent.io/)
- [Confluent Support](https://support.confluent.io/)
- [Confluent Slack Community](https://slackpass.io/confluentcommunity)
