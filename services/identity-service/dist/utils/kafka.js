"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishEvent = void 0;
const kafkajs_1 = require("kafkajs");
const env_1 = require("../config/env");
let producer = null;
const getProducer = async () => {
    if (producer)
        return producer;
    const kafka = new kafkajs_1.Kafka({
        clientId: env_1.config.kafka.clientId,
        brokers: env_1.config.kafka.brokers,
    });
    producer = kafka.producer();
    await producer.connect();
    return producer;
};
const publishEvent = async (topic, key, payload) => {
    try {
        const p = await getProducer();
        await p.send({
            topic,
            messages: [{ key, value: JSON.stringify(payload) }],
        });
    }
    catch (error) {
        console.error(`[Kafka] Failed to publish to ${topic}:`, error);
    }
};
exports.publishEvent = publishEvent;
//# sourceMappingURL=kafka.js.map