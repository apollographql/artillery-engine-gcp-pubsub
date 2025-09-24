const A = require("async");
const debug = require("debug")("engine:gcp-pubsub");
const { PubSub } = require("@google-cloud/pubsub");

class GcpPubsubEngine {
  // Artillery initializes each engine with the following arguments:
  //
  // - script is the entire script object, with .config and .scenarios properties
  // - ee is an EventEmitter we can use to subscribe to events from Artillery, and
  //   to report custom metrics
  // - helpers is a collection of utility functions
  constructor(script, ee, helpers) {
    this.script = script;
    this.ee = ee;
    this.helpers = helpers;

    const config = { ...this.script.config };

    // The targe is unused but required for Artillery to function. It is not
    // possible to use the queue as the target because it must be a URI.
    this.target = config.target;

    this.project = config.project;
    if (!this.project) {
      throw new Error("'[project]' missing from environment config");
    }

    this.topic = config.topic;
    if (!this.topic) {
      throw new Error("'[topic]' missing from environment config");
    }

    const opts = config.engines?.gcppubsub || {};
    this.dryrun = opts.dryrun || false;

    return this;
  }

  // For each scenario in the script using this engine, Artillery calls this function
  // to create a VU function
  createScenario(scenarioSpec, ee) {
    const self = this;
    const flow = scenarioSpec.flow || [];
    const tasks = flow.map((rs) => this.step(rs, ee));

    return function scenario(initialContext, callback) {
      ee.emit("started");

      function init(next) {
        // Initialize Google Cloud Pub/Sub client
        debug("Initializing Google Cloud Pub/Sub client");
        initialContext.publisher = new PubSub({ projectId: self.project })
          .topic(
            self.topic,
            {
              // The Pub/Sub client will batch at most this many messages or wait at
              // most this many seconds before sending the batch. maxMessages may be
              // set to at most 1000.
              batching: {
                maxMessages: 1000,
                maxMilliseconds: 3 * 1000,
              },
            }
          );

        return next(null, initialContext);
      }

      const steps = [init].concat(tasks);

      A.waterfall(steps, function done(err, context) {
        if (err) {
          debug(err);
        }

        return callback(err, context);
      });
    };
  }

  // This is a convenience function where we delegate common actions like loop, log, and think,
  // and handle actions which are custom for our engine, i.e. the "doSomething" action in this case
  step(rs, ee) {
    const self = this;
    if (rs.loop) {
      const steps = rs.loop.map((loopStep) => this.step(loopStep, ee));
      return this.helpers.createLoopWithCount(rs.count || -1, steps, {});
    }

    if (rs.log) {
      return function log(context, callback) {
        return process.nextTick(function () {
          callback(null, context);
        });
      };
    }

    if (rs.think) {
      return this.helpers.createThink(rs, self.script.config?.defaults?.think || {});
    }

    if (rs.function) {
      return function (context, callback) {
        let func = self.script.config.processor?.[rs.function];
        if (!func) {
          return process.nextTick(function () {
            callback(null, context);
          });
        }

        return func(context, ee, function () {
          return callback(null, context);
        });
      };
    }

    //
    // This is our custom action:
    //
    if (rs.message) {
      return function message(context, callback) {
        if (!rs.message.json) {
          throw new Error("json must be set");
        }

        // Publish message to Google Cloud Pub/Sub
        const multiplier = rs.message.multiplier !== undefined ? rs.message.multiplier : 1;
        
        // Handle edge cases for multiplier
        if (multiplier <= 0) {
          return callback(null, context);
        }

        const publishPromises = [];

        for (let i = 0; i < multiplier; i++) {
          let message;
          try {
            message = JSON.stringify(self.helpers.template(rs.message.json, context));
          } catch (error) {
            debug("Error processing template:", error);
            return callback(error, context);
          }
          debug("Publishing message to topic (%s): %s", self.topic, message);

          if (!self.dryrun) {
            const publishPromise = context.publisher.publishMessage({
              data: Buffer.from(message),
              attributes: rs.message.attributes || {}
            })
            .then((messageId) => {
              debug("Message published with ID:", messageId);
              
              // Emit a metric to count the number of messages published:
              ee.emit("counter", "gcppubsub.messages_published", 1);
              ee.emit("histogram", "gcppubsub.publish_latency", Date.now() - context.startTime);
              
              return messageId;
            })
            .catch((error) => {
              debug("Error publishing message:", error);
              // Emit error metrics
              ee.emit("counter", "gcppubsub.publish_errors", 1);
              throw error;
            });
            
            publishPromises.push(publishPromise);
          }
        }

        if (self.dryrun) {
          // In dryrun mode, just call the callback immediately
          return callback(null, context);
        }

        // Wait for all messages to complete
        Promise.all(publishPromises)
          .then(() => {
            callback(null, context);
          })
          .catch((error) => {
            callback(error, context);
          });
      }
    }

    //
    // Ignore any unrecognized actions:
    //
    return function doNothing(context, callback) {
      return callback(null, context);
    };
  }
}

module.exports = GcpPubsubEngine;
