const GcpPubsubEngine = require('../index.js');

describe('GcpPubsubEngine Edge Cases', () => {
  let mockScript;
  let mockEe;
  let mockHelpers;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEe = {
      emit: jest.fn(),
      on: jest.fn()
    };

    mockHelpers = {
      createLoopWithCount: jest.fn(),
      createThink: jest.fn(),
      template: jest.fn((template, context) => template)
    };

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

  describe('Configuration Edge Cases', () => {
    test('should handle empty configuration object', () => {
      const emptyConfig = {
        config: {
          target: 'http://localhost',
          project: 'test-project',
          topic: 'test-topic',
          engines: {}
        }
      };

      expect(() => {
        new GcpPubsubEngine(emptyConfig, mockEe, mockHelpers);
      }).not.toThrow();
    });

    test('should handle missing engines configuration', () => {
      const noEnginesConfig = {
        config: {
          target: 'http://localhost',
          project: 'test-project',
          topic: 'test-topic'
        }
      };

      expect(() => {
        new GcpPubsubEngine(noEnginesConfig, mockEe, mockHelpers);
      }).not.toThrow();
    });

    test('should handle null values in configuration', () => {
      const nullConfig = {
        config: {
          target: null,
          project: 'test-project',
          topic: 'test-topic',
          engines: {
            gcppubsub: {
              dryrun: null
            }
          }
        }
      };

      const engine = new GcpPubsubEngine(nullConfig, mockEe, mockHelpers);
      expect(engine.target).toBeNull();
      expect(engine.dryrun).toBe(false); // Should default to false
    });

    test('should handle undefined values in configuration', () => {
      const undefinedConfig = {
        config: {
          target: undefined,
          project: 'test-project',
          topic: 'test-topic',
          engines: {
            gcppubsub: {
              dryrun: undefined
            }
          }
        }
      };

      const engine = new GcpPubsubEngine(undefinedConfig, mockEe, mockHelpers);
      expect(engine.target).toBeUndefined();
      expect(engine.dryrun).toBe(false); // Should default to false
    });
  });

  describe('Message Publishing Edge Cases', () => {
    let engine;
    let mockTopic;

    beforeEach(() => {
      engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      mockTopic = {
        publishMessage: jest.fn().mockResolvedValue('mock-message-id')
      };
    });

    test('should handle empty message json', (done) => {
      const messageStep = {
        message: {
          json: {},
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
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          data: Buffer.from('{}'),
          attributes: {}
        });
        done();
      });
    });

    test('should handle null message json', (done) => {
      const messageStep = {
        message: {
          json: null,
          multiplier: 1
        }
      };

      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: mockTopic,
        startTime: Date.now()
      };

      expect(() => {
        step(context, (err, resultContext) => {
          // This should throw an error
        });
      }).toThrow('json must be set');
      done();
    });

    test('should handle zero multiplier', (done) => {
      const messageStep = {
        message: {
          json: { test: 'data' },
          multiplier: 0
        }
      };

      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: mockTopic,
        startTime: Date.now()
      };

      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        // With zero multiplier, no messages should be published
        expect(mockTopic.publishMessage).not.toHaveBeenCalled();
        done();
      });
    });

    test('should handle negative multiplier', (done) => {
      const messageStep = {
        message: {
          json: { test: 'data' },
          multiplier: -1
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

    test('should handle large multiplier', (done) => {
      const messageStep = {
        message: {
          json: { test: 'data' },
          multiplier: 1000
        }
      };

      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: mockTopic,
        startTime: Date.now()
      };

      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(mockTopic.publishMessage).toHaveBeenCalledTimes(1000);
        done();
      });
    });

    test('should handle missing attributes', (done) => {
      const messageStep = {
        message: {
          json: { test: 'data' },
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
        expect(mockTopic.publishMessage).toHaveBeenCalledWith({
          data: Buffer.from(JSON.stringify({ test: 'data' })),
          attributes: {}
        });
        done();
      });
    });

    test('should handle null attributes', (done) => {
      const messageStep = {
        message: {
          json: { test: 'data' },
          multiplier: 1,
          attributes: null
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
          data: Buffer.from(JSON.stringify({ test: 'data' })),
          attributes: {}
        });
        done();
      });
    });
  });

  describe('Scenario Edge Cases', () => {
    let engine;

    beforeEach(() => {
      engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
    });

    test('should handle empty flow array', (done) => {
      const scenarioSpec = {
        flow: []
      };

      const scenario = engine.createScenario(scenarioSpec, mockEe);
      const initialContext = { startTime: Date.now() };

      scenario(initialContext, (err, context) => {
        expect(err).toBeNull();
        expect(context).toBeDefined();
        done();
      });
    });

    test('should handle null flow', (done) => {
      const scenarioSpec = {
        flow: null
      };

      const scenario = engine.createScenario(scenarioSpec, mockEe);
      const initialContext = { startTime: Date.now() };

      scenario(initialContext, (err, context) => {
        expect(err).toBeNull();
        expect(context).toBeDefined();
        done();
      });
    });

    test('should handle undefined flow', (done) => {
      const scenarioSpec = {
        flow: undefined
      };

      const scenario = engine.createScenario(scenarioSpec, mockEe);
      const initialContext = { startTime: Date.now() };

      scenario(initialContext, (err, context) => {
        expect(err).toBeNull();
        expect(context).toBeDefined();
        done();
      });
    });

    test('should handle nested loops', () => {
      const nestedLoopStep = {
        loop: [
          {
            loop: [
              { message: { json: { nested: true } } }
            ],
            count: 2
          }
        ],
        count: 3
      };

      const step = engine.step(nestedLoopStep, mockEe);
      expect(mockHelpers.createLoopWithCount).toHaveBeenCalledWith(3, expect.any(Array), {});
    });

    test('should handle complex nested scenarios', () => {
      const complexStep = {
        loop: [
          { log: 'Starting loop' },
          { think: 100 },
          {
            loop: [
              { message: { json: { inner: true } } },
              { think: 50 }
            ],
            count: 2
          },
          { message: { json: { outer: true } } }
        ],
        count: 2
      };

      const step = engine.step(complexStep, mockEe);
      expect(mockHelpers.createLoopWithCount).toHaveBeenCalledWith(2, expect.any(Array), {});
    });
  });

  describe('Error Recovery', () => {
    let engine;
    let mockTopic;

    beforeEach(() => {
      engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      mockTopic = {
        publishMessage: jest.fn()
      };
    });

    test('should handle publish errors gracefully', (done) => {
      const publishError = new Error('Network timeout');
      mockTopic.publishMessage.mockRejectedValue(publishError);

      const messageStep = {
        message: {
          json: { test: 'data' },
          multiplier: 3
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
        // Should attempt to publish all messages before failing (current behavior)
        expect(mockTopic.publishMessage).toHaveBeenCalledTimes(3);
        done();
      });
    });

    test('should handle template errors', (done) => {
      mockHelpers.template.mockImplementation(() => {
        throw new Error('Template error');
      });

      const messageStep = {
        message: {
          json: { test: '{{ invalidTemplate }}' },
          multiplier: 1
        }
      };

      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: mockTopic,
        startTime: Date.now()
      };

      step(context, (err, resultContext) => {
        expect(err).toBeDefined();
        expect(err.message).toBe('Template error');
        done();
      });
    });
  });

  describe('Performance Edge Cases', () => {
    test('should handle high-frequency message publishing', (done) => {
      const engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      
      const messageStep = {
        message: {
          json: { test: 'data' },
          multiplier: 100
        }
      };

      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: {
          publishMessage: jest.fn().mockResolvedValue('mock-message-id')
        },
        startTime: Date.now()
      };

      const startTime = Date.now();
      step(context, (err, resultContext) => {
        const endTime = Date.now();
        expect(err).toBeNull();
        expect(context.publisher.publishMessage).toHaveBeenCalledTimes(100);
        // Should complete reasonably quickly even with many messages
        expect(endTime - startTime).toBeLessThan(1000);
        done();
      });
    });

    test('should handle maximum recommended multiplier (1000)', (done) => {
      const engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      
      const messageStep = {
        message: {
          json: { 
            batchId: '{{ $randomString() }}',
            messageNumber: '{{ $loopCount }}',
            payload: 'Large batch test data'
          },
          multiplier: 1000,
          attributes: {
            batchType: 'maximum',
            size: '1000'
          }
        }
      };

      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: {
          publishMessage: jest.fn().mockResolvedValue('mock-message-id')
        },
        startTime: Date.now()
      };

      const startTime = Date.now();
      step(context, (err, resultContext) => {
        const endTime = Date.now();
        
        expect(err).toBeNull();
        expect(context.publisher.publishMessage).toHaveBeenCalledTimes(1000);
        
        // Verify the message structure
        const expectedCall = {
          data: Buffer.from(JSON.stringify({ 
            batchId: '{{ $randomString() }}',
            messageNumber: '{{ $loopCount }}',
            payload: 'Large batch test data'
          })),
          attributes: {
            batchType: 'maximum',
            size: '1000'
          }
        };
        
        expect(context.publisher.publishMessage).toHaveBeenCalledWith(expectedCall);
        
        // Performance check - should complete within reasonable time even with 1000 messages
        expect(endTime - startTime).toBeLessThan(2000);
        
        done();
      });
    });
  });
});