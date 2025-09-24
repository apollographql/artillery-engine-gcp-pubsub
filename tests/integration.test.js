const GcpPubsubEngine = require('../index.js');

describe('GcpPubsubEngine Integration Tests', () => {
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
      createLoopWithCount: jest.fn((count, steps, options) => {
        return function loop(context, callback) {
          let currentCount = 0;
          function next() {
            if (currentCount >= count) {
              return callback(null, context);
            }
            currentCount++;
            // Execute first step
            if (steps.length > 0) {
              steps[0](context, next);
            } else {
              next();
            }
          }
          next();
        };
      }),
      createThink: jest.fn((rs, defaults) => {
        return function think(context, callback) {
          setTimeout(() => callback(null, context), rs.think || defaults.think || 0);
        };
      }),
      template: jest.fn((template, context) => {
        // Simple template replacement for testing
        return JSON.parse(JSON.stringify(template).replace(/\{\{([^}]+)\}\}/g, (match, key) => {
          return context[key.trim()] || match;
        }));
      })
    };

    mockScript = {
      config: {
        target: 'http://localhost',
        project: 'test-project',
        topic: 'test-topic',
        engines: {
          gcppubsub: {
            dryrun: true // Use dryrun for integration tests
          }
        },
        defaults: {
          think: 100
        }
      }
    };
  });

  describe('Complete Scenario Flow', () => {
    test('should execute a complete scenario with multiple steps', (done) => {
      const engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      
      const scenarioSpec = {
        flow: [
          { log: 'Starting scenario' },
          { think: 50 },
          { message: { json: { userId: '123', message: 'Hello' } } },
          { think: 100 },
          { message: { json: { userId: '456', message: 'World' } } }
        ]
      };

      const scenario = engine.createScenario(scenarioSpec, mockEe);
      const initialContext = { 
        startTime: Date.now(),
        userId: 'test-user'
      };

      scenario(initialContext, (err, context) => {
        expect(err).toBeNull();
        expect(context).toBeDefined();
        expect(mockEe.emit).toHaveBeenCalledWith('started');
        done();
      });
    });

    test('should handle loop scenarios', (done) => {
      const engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      
      const scenarioSpec = {
        flow: [
          {
            loop: [
              { message: { json: { iteration: '{{ $loopCount }}' } } },
              { think: 10 }
            ],
            count: 3
          }
        ]
      };

      const scenario = engine.createScenario(scenarioSpec, mockEe);
      const initialContext = { 
        startTime: Date.now()
      };

      scenario(initialContext, (err, context) => {
        expect(err).toBeNull();
        expect(context).toBeDefined();
        expect(mockHelpers.createLoopWithCount).toHaveBeenCalledWith(3, expect.any(Array), {});
        done();
      });
    });

    test('should handle function scenarios', (done) => {
      const testFunction = jest.fn((context, ee, callback) => {
        context.customData = 'processed';
        callback();
      });

      mockScript.config.processor = {
        testProcessor: testFunction
      };

      const engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      
      const scenarioSpec = {
        flow: [
          { function: 'testProcessor' },
          { message: { json: { data: '{{ customData }}' } } }
        ]
      };

      const scenario = engine.createScenario(scenarioSpec, mockEe);
      const initialContext = { 
        startTime: Date.now()
      };

      scenario(initialContext, (err, context) => {
        expect(err).toBeNull();
        expect(context).toBeDefined();
        expect(testFunction).toHaveBeenCalledWith(context, mockEe, expect.any(Function));
        done();
      });
    });
  });

  describe('Configuration Scenarios', () => {
    test('should handle different environment configurations', () => {
      const stagingConfig = {
        ...mockScript.config,
        project: 'staging-project',
        topic: 'staging-topic'
      };

      const productionConfig = {
        ...mockScript.config,
        project: 'production-project',
        topic: 'production-topic'
      };

      const stagingScript = { ...mockScript, config: stagingConfig };
      const productionScript = { ...mockScript, config: productionConfig };

      const stagingEngine = new GcpPubsubEngine(stagingScript, mockEe, mockHelpers);
      const productionEngine = new GcpPubsubEngine(productionScript, mockEe, mockHelpers);

      expect(stagingEngine.project).toBe('staging-project');
      expect(stagingEngine.topic).toBe('staging-topic');
      expect(productionEngine.project).toBe('production-project');
      expect(productionEngine.topic).toBe('production-topic');
    });

    test('should handle custom engine options', () => {
      const customConfig = {
        ...mockScript.config,
        engines: {
          gcppubsub: {
            dryrun: true,
            customOption: 'test-value'
          }
        }
      };

      const customScript = { ...mockScript, config: customConfig };
      const engine = new GcpPubsubEngine(customScript, mockEe, mockHelpers);

      expect(engine.dryrun).toBe(true);
    });
  });

  describe('Message Attributes and Templates', () => {
    test('should handle message attributes', (done) => {
      // Create a non-dryrun engine for this test
      const testScript = {
        ...mockScript,
        config: {
          ...mockScript.config,
          engines: {
            gcppubsub: {
              dryrun: false
            }
          }
        }
      };
      
      const engine = new GcpPubsubEngine(testScript, mockEe, mockHelpers);
      
      const messageStep = {
        message: {
          json: { userId: '123' },
          attributes: {
            source: 'artillery-test',
            environment: 'staging',
            customAttr: 'test-value'
          }
        }
      };

      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: { publishMessage: jest.fn().mockResolvedValue('msg-id') },
        startTime: Date.now()
      };

      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(context.publisher.publishMessage).toHaveBeenCalledWith({
          data: Buffer.from(JSON.stringify({ userId: '123' })),
          attributes: {
            source: 'artillery-test',
            environment: 'staging',
            customAttr: 'test-value'
          }
        });
        done();
      });
    });

    test('should handle template variables in messages', (done) => {
      const engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
      
      const messageStep = {
        message: {
          json: {
            userId: '{{ userId }}',
            message: 'Hello {{ userName }}',
            timestamp: '{{ timestamp }}'
          }
        }
      };

      const step = engine.step(messageStep, mockEe);
      const context = {
        publisher: { publishMessage: jest.fn().mockResolvedValue('msg-id') },
        startTime: Date.now(),
        userId: '123',
        userName: 'John',
        timestamp: '2023-01-01T00:00:00Z'
      };

      step(context, (err, resultContext) => {
        expect(err).toBeNull();
        expect(mockHelpers.template).toHaveBeenCalledWith(messageStep.message.json, context);
        done();
      });
    });
  });
});