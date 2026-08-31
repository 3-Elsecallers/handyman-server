import { Kafka, Producer, Consumer } from "kafkajs";
import { config } from "../config/env";

let producer: Producer | null = null;

const getProducer = async (): Promise<Producer> => {
  if (producer) return producer;

  const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
  });

  producer = kafka.producer();
  await producer.connect();
  return producer;
};

export const publishEvent = async (
  topic: string,
  key: string,
  payload: Record<string, unknown>,
) => {
  try {
    const p = await getProducer();
    await p.send({
      topic,
      messages: [{ key, value: JSON.stringify(payload) }],
    });
  } catch (error) {
    console.error(`[Kafka] Failed to publish to ${topic}:`, error);
  }
};

export const createConsumer = async (
  topic: string,
  handler: (value: Record<string, unknown>) => Promise<void>,
) => {
  try {
    const kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
    });

    const consumer = kafka.consumer({
      groupId: `${config.kafka.groupId}-${topic}`,
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
        } catch (error) {
          console.error(`[Kafka] Error processing message from ${topic}:`, error);
        }
      },
    });

    return consumer;
  } catch (error) {
    console.error(`[Kafka] Failed to consume from ${topic}:`, error);
    return null;
  }
};
