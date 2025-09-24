// Jest setup file for additional configuration
// This file is run before each test file

// Mock debug module to prevent console output during tests
jest.mock('debug', () => {
  return () => () => {};
});

// Mock @google-cloud/pubsub to avoid actual GCP calls during tests
jest.mock('@google-cloud/pubsub', () => {
  const mockTopic = {
    publishMessage: jest.fn().mockResolvedValue('mock-message-id')
  };
  
  const mockPubSub = jest.fn().mockImplementation(() => ({
    topic: jest.fn().mockReturnValue(mockTopic)
  }));
  
  return {
    PubSub: mockPubSub
  };
});