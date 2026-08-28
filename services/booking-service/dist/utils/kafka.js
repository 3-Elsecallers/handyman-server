"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConsumer = exports.publishEvent = void 0;
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
const createConsumer = async (topic, handler) => {
    try {
        const kafka = new kafkajs_1.Kafka({
            clientId: env_1.config.kafka.clientId,
            brokers: env_1.config.kafka.brokers,
        });
        const consumer = kafka.consumer({
            groupId: `${env_1.config.kafka.groupId}-${topic}`,
        });
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning: true });
        await consumer.run({
            eachMessage: async ({ message }) => {
                try {
                    if (message.value) {
                        const value = JSON.parse(message.value.toString());
                        await handler(value);
                    }
                }
                catch (error) {
                    console.error(`[Kafka] Error processing message from ${topic}:`, error);
                }
            },
        });
        return consumer;
    }
    catch (error) {
        console.error(`[Kafka] Failed to consume from ${topic}:`, error);
        return null;
    }
};
exports.createConsumer = createConsumer;
//# sourceMappingURL=kafka.js.map