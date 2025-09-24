# Engine GCP Pub/Sub

An Artillery engine for generating testing load against a Google Cloud Pub/Sub topic. 

## Installation

```bash
npm install
```

### Configuration

See [example-config.yml](example-config.yml) configuration file.

## Dependencies

- `async`: For handling asynchronous operations
- `debug`: For debugging output
- `@google-cloud/pubsub`: Google Cloud Pub/Sub client library

## Environment Setup

Make sure you have:
1. A Google Cloud Project with Pub/Sub API enabled
2. Service account credentials with Pub/Sub permissions
3. The `GOOGLE_APPLICATION_CREDENTIALS` environment variable set
