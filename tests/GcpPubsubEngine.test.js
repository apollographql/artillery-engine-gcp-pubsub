const GcpPubsubEngine = require('../index.js');
const { PubSub } = require('@google-cloud/pubsub');

describe('GcpPubsubEngine', () => {
  let mockScript;
  let mockEe;
  let mockHelpers;
  let engine;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock EventEmitter
    mockEe = {
      emit: jest.fn(),
      on: jest.fn()
    };

    // Mock helpers
    mockHelpers = {
      createLoopWithCount: jest.fn(),
      createThink: jest.fn(),
      template: jest.fn((template, context) => template)
    };

    // Mock script configuration
    mockScript = {
      config: {
        target: 'http://localhost',
        project: 'test-project',
        topic: 'test-topic',
        engines: {
          gcppubsub: {
            dryrun: false
          }
        }
      }
    };
  });

  describe('Constructor', () => {
    test('should initialize with valid configuration', () => {
      expect(() => {
        engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      }).not.toThrow();

      expect(engine.target).toBe('http://localhost');
      expect(engine.project).toBe('test-project');
      expect(engine.topic).toBe('test-topic');
      expect(engine.dryrun).toBe(false);
    });

    test('should throw error when project is missing', () => {
      delete mockScript.config.project;
      
      expect(() => {
        engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      }).toThrow("'[project]' missing from environment config");
    });

    test('should throw error when topic is missing', () => {
      delete mockScript.config.topic;
      
      expect(() => {
        engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      }).toThrow("'[topic]' missing from environment config");
    });

    test('should set dryrun to true when specified', () => {
      mockScript.config.engines.gcppubsub.dryrun = true;
      
      engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      expect(engine.dryrun).toBe(true);
    });

    test('should default dryrun to false when not specified', () => {
      delete mockScript.config.engines.gcppubsub.dryrun;
      
      engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      expect(engine.dryrun).toBe(false);
    });
  });

  describe('createScenario', () => {
    beforeEach(() => {
      engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
    });

    test('should create a scenario function', () => {
      const scenarioSpec = {
        flow: [
          { message: { json: { test: 'data' } } }
        ]
      };

      const scenario = engine.createScenario(scenarioSpec, mockEe);
      expect(typeof scenario).toBe('function');
    });

    test('should initialize PubSub client in scenario', (done) => {
      const scenarioSpec = {
        flow: [
          { message: { json: { test: 'data' } } }
        ]
      };

      const scenario = engine.createScenario(scenarioSpec, mockEe);
      const initialContext = { startTime: Date.now() };

      scenario(initialContext, (err, context) => {
        expect(err).toBeNull();
        expect(context.publisher).toBeDefined();
        expect(PubSub).toHaveBeenCalledWith({ projectId: 'test-project' });
        done();
      });
    });

    test('should emit started event', (done) => {
      const scenarioSpec = {
        flow: [
          { message: { json: { test: 'data' } } }
        ]
      };

      const scenario = engine.createScenario(scenarioSpec, mockEe);
      const initialContext = { startTime: Date.now() };

      scenario(initialContext, (err, context) => {
        expect(mockEe.emit).toHaveBeenCalledWith('started');
        done();
      });
    });
  });

  describe('step method', () => {
    beforeEach(() => {
      engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
    });

    test('should handle loop steps', () => {
      const loopStep = {
        loop: [
          { message: { json: { test: 'data' } } }
        ],
        count: 5
      };

      const step = engine.step(loopStep, mockEe);
      expect(mockHelpers.createLoopWithCount).toHaveBeenCalledWith(5, expect.any(Array), {});
    });

    test('should handle log steps', () => {
      const logStep = { log: 'test message' };
      const step = engine.step(logStep, mockEe);
      
      expect(typeof step).toBe('function');
      
      // Test the log function
      const context = { test: 'context' };
      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(resultContext).toBe(context);
      });
    });

    test('should handle think steps', () => {
      const thinkStep = { think: 1000 };
      engine.step(thinkStep, mockEe);
      
      expect(mockHelpers.createThink).toHaveBeenCalledWith(thinkStep, {});
    });

    test('should handle function steps', () => {
      const func = jest.fn();
      mockScript.config.processor = { testFunction: func };
      
      const functionStep = { function: 'testFunction' };
      const step = engine.step(functionStep, mockEe);
      
      expect(typeof step).toBe('function');
      
      const context = { test: 'context' };
      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(resultContext).toBe(context);
        expect(func).toHaveBeenCalledWith(context, mockEe, expect.any(Function));
      });
    });

    test('should handle function steps with missing processor', () => {
      const functionStep = { function: 'missingFunction' };
      const step = engine.step(functionStep, mockEe);
      
      expect(typeof step).toBe('function');
      
      const context = { test: 'context' };
      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(resultContext).toBe(context);
      });
    });

    test('should handle message steps', () => {
      const messageStep = {
        message: {
          json: { test: 'data' },
          multiplier: 2,
          attributes: { source: 'test' }
        }
      };
      
      const step = engine.step(messageStep, mockEe);
      expect(typeof step).toBe('function');
    });

    test('should throw error for message step without json', () => {
      const messageStep = {
        message: {
          multiplier: 1
        }
      };
      
      const step = engine.step(messageStep, mockEe);
      
      expect(() => {
        step({}, () => {});
      }).toThrow('json must be set');
    });

    test('should handle unrecognized steps', () => {
      const unknownStep = { unknown: 'action' };
      const step = engine.step(unknownStep, mockEe);
      
      expect(typeof step).toBe('function');
      
      const context = { test: 'context' };
      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(resultContext).toBe(context);
      });
    });
  });

  describe('Message Publishing', () => {
    let mockTopic;
    let mockPubSub;

    beforeEach(() => {
      engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      
      // Get the mocked PubSub instance
      mockPubSub = new PubSub();
      mockTopic = mockPubSub.topic();
      
      // Reset the mock to default resolved behavior
      mockTopic.publishMessage.mockResolvedValue('mock-message-id');
    });

    test('should publish message successfully', (done) => {
      const messageStep = {
        message: {
          json: { userId: '123', message: 'Hello' },
          multiplier: 1,
          attributes: { source: 'test' }
        }
      };
      
      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: mockTopic,
        startTime: Date.now()
      };

      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          data: Buffer.from(JSON.stringify({ userId: '123', message: 'Hello' })),
          attributes: { source: 'test' }
        });
        expect(mockEe.emit).toHaveBeenCalledWith('counter', 'gcppubsub.messages_published', 1);
        expect(mockEe.emit).toHaveBeenCalledWith('histogram', 'gcppubsub.publish_latency', expect.any(Number));
        done();
      });
    });

    test('should handle multiple messages with multiplier', (done) => {
      const messageStep = {
        message: {
          json: { userId: '123', message: 'Hello' },
          multiplier: 3,
          attributes: { source: 'test' }
        }
      };
      
      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: mockTopic,
        startTime: Date.now()
      };

      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(mockTopic.publishMessage).toHaveBeenCalledTimes(3);
        expect(mockEe.emit).toHaveBeenCalledWith('counter', 'gcppubsub.messages_published', 1);
        done();
      });
    });

    test('should skip publishing in dryrun mode', (done) => {
      engine.dryrun = true;
      
      const messageStep = {
        message: {
          json: { userId: '123', message: 'Hello' },
          multiplier: 1
        }
      };
      
      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: mockTopic,
        startTime: Date.now()
      };

      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(mockTopic.publishMessage).not.toHaveBeenCalled();
        done();
      });
    });

    test('should handle publish errors', (done) => {
      const publishError = new Error('Publish failed');
      mockTopic.publishMessage.mockRejectedValue(publishError);
      
      const messageStep = {
        message: {
          json: { userId: '123', message: 'Hello' },
          multiplier: 1
        }
      };
      
      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: mockTopic,
        startTime: Date.now()
      };

      step(context, (err, resultContext) => {
        expect(err).toBe(publishError);
        expect(mockEe.emit).toHaveBeenCalledWith('counter', 'gcppubsub.publish_errors', 1);
        done();
      });
    });

    test('should use template helper for message content', (done) => {
      const templateData = { userId: '123', message: 'Hello {{ userId }}' };
      mockHelpers.template.mockReturnValue({ userId: '123', message: 'Hello 123' });
      
      const messageStep = {
        message: {
          json: templateData,
          multiplier: 1
        }
      };
      
      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: mockTopic,
        startTime: Date.now()
      };

      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(mockHelpers.template).toHaveBeenCalledWith(templateData, context);
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          data: Buffer.from(JSON.stringify({ userId: '123', message: 'Hello 123' })),
          attributes: {}
        });
        done();
      });
    });

    test('should handle higher multiplier efficiently', (done) => {
      const messageStep = {
        message: {
          json: { 
            userId: '{{ userId }}', 
            message: 'Batch message {{ $loopCount }}',
            timestamp: '{{ $timestamp }}'
          },
          multiplier: 100,
          attributes: {
            source: 'artillery-test',
            batchSize: 'large'
          }
        }
      };
      
      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: mockTopic,
        startTime: Date.now(),
        userId: 'test-user'
      };

      const startTime = Date.now();
      step(context, (err, resultContext) => {
        const endTime = Date.now();
        
        expect(err).toBeNull();
        expect(mockTopic.publishMessage).toHaveBeenCalledTimes(100);
        expect(mockEe.emit).toHaveBeenCalledWith('counter', 'gcppubsub.messages_published', 1);
        expect(mockEe.emit).toHaveBeenCalledWith('histogram', 'gcppubsub.publish_latency', expect.any(Number));
        
        // Verify all messages were published with correct attributes
        // The template helper should be called for each message
        expect(mockHelpers.template).toHaveBeenCalledTimes(100);
        expect(mockHelpers.template).toHaveBeenCalledWith({ 
          userId: '{{ userId }}', 
          message: 'Batch message {{ $loopCount }}',
          timestamp: '{{ $timestamp }}'
        }, context);
        
        // Verify the message structure (template processing happens in the engine)
        const expectedCall = {
          data: Buffer.from(JSON.stringify({ 
            userId: '{{ userId }}', 
            message: 'Batch message {{ $loopCount }}',
            timestamp: '{{ $timestamp }}'
          })),
          attributes: {
            source: 'artillery-test',
            batchSize: 'large'
          }
        };
        
        expect(mockTopic.publishMessage).toHaveBeenCalledWith(expectedCall);
        
        // Performance check - should complete reasonably quickly even with 100 messages
        expect(endTime - startTime).toBeLessThan(1000);
        
        done();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
    });

    test('should handle scenario execution errors', (done) => {
      const scenarioSpec = {
        flow: [
          { message: { json: { test: 'data' } } }
        ]
      };

      const scenario = engine.createScenario(scenarioSpec, mockEe);
      const initialContext = { startTime: Date.now() };

      // Mock an error in the waterfall
      const originalWaterfall = require('async').waterfall;
      require('async').waterfall = jest.fn((steps, callback) => {
        callback(new Error('Scenario execution failed'), null);
      });

      scenario(initialContext, (err, context) => {
        expect(err).toBeDefined();
        expect(err.message).toBe('Scenario execution failed');
        
        // Restore original waterfall
        require('async').waterfall = originalWaterfall;
        done();
      });
    });
  });
});