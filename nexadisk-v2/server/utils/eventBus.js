const EventEmitter = require('events');
const logger = require('./logger');

class EventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50); // Set high limits for multi-service callbacks
    }

    publish(eventName, data) {
        logger.info(`[EventBus Publish] Event: "${eventName}"`, { data });
        // Emit events asynchronously to prevent thread blocking
        setImmediate(() => {
            this.emit(eventName, data);
        });
    }

    subscribe(eventName, callback) {
        logger.info(`[EventBus Subscribe] Registered listener for: "${eventName}"`);
        this.on(eventName, (data) => {
            try {
                callback(data);
            } catch (err) {
                logger.error(`[EventBus Error] Exception in subscription callback for event "${eventName}": ${err.message}`, err);
            }
        });
    }
}

const eventBus = new EventBus();
module.exports = eventBus;
