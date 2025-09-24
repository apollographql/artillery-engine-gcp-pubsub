# Test Suite for Artillery GCP Pub/Sub Engine

This directory contains comprehensive unit tests for the Artillery GCP Pub/Sub Engine.

## Test Structure

### Test Files

- **`GcpPubsubEngine.test.js`** - Main unit tests covering core functionality
- **`integration.test.js`** - Integration tests for complete scenarios
- **`edge-cases.test.js`** - Edge cases and error handling tests
- **`index.test.js`** - Module export and basic instantiation tests

### Test Configuration

- **`test-config.yml`** - Sample Artillery configuration for testing
- **`test-data.csv`** - Sample CSV data for parameterized testing

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

## Test Coverage

The test suite covers:

### Core Functionality
- ✅ Constructor initialization and configuration validation
- ✅ Scenario creation and execution
- ✅ Step processing (message, loop, think, log, function)
- ✅ Message publishing to Google Cloud Pub/Sub
- ✅ Template processing and variable substitution
- ✅ Error handling and recovery

### Edge Cases
- ✅ Empty and null configurations
- ✅ Missing required parameters
- ✅ Invalid message formats
- ✅ Large multipliers and performance scenarios
- ✅ Nested loops and complex scenarios
- ✅ Template errors and publish failures

### Integration Scenarios
- ✅ Complete scenario flows
- ✅ Multiple step combinations
- ✅ Loop scenarios with nested steps
- ✅ Function processor integration
- ✅ Different environment configurations

## Mocking Strategy

The tests use Jest mocks to avoid actual Google Cloud Pub/Sub calls:

- **`@google-cloud/pubsub`** - Mocked to prevent actual GCP API calls
- **`debug`** - Mocked to prevent console output during tests
- **EventEmitter** - Mocked for testing event emissions
- **Helpers** - Mocked for testing template processing and utilities

## Test Data

Sample test data is provided in `test-data.csv` for parameterized testing scenarios.

## Configuration Testing

The `test-config.yml` file provides a complete Artillery configuration example that can be used for manual testing and validation.

## Continuous Integration

These tests are designed to run in CI/CD environments without requiring actual Google Cloud credentials or Pub/Sub topics.