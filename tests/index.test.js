const GcpPubsubEngine = require('../index.js');

describe('Module Export', () => {
  test('should export GcpPubsubEngine class', () => {
    expect(GcpPubsubEngine).toBeDefined();
    expect(typeof GcpPubsubEngine).toBe('function');
    expect(GcpPubsubEngine.name).toBe('GcpPubsubEngine');
  });

  test('should be instantiable', () => {
    const mockScript = {
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

    const mockEe = {
      emit: jest.fn(),
      on: jest.fn()
    };

    const mockHelpers = {
      createLoopWithCount: jest.fn(),
      createThink: jest.fn(),
      template: jest.fn()
    };

    expect(() => {
      new GcpPubsubEngine(mockScript, mockEe, mockHelpers);
    }).not.toThrow();
  });

  test('should have required methods', () => {
    const mockScript = {
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

    const mockEe = {
      emit: jest.fn(),
      on: jest.fn()
    };

    const mockHelpers = {
      createLoopWithCount: jest.fn(),
      createThink: jest.fn(),
      template: jest.fn()
    };

    const engine = new GcpPubsubEngine(mockScript, mockEe, mockHelpers);

    expect(typeof engine.createScenario).toBe('function');
    expect(typeof engine.step).toBe('function');
  });
});