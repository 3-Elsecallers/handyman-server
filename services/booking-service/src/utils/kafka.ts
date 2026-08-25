import { Kafka, Producer } from "kafkajs";
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
    console.log(`[Kafka] Published to ${topic}: ${key}`);
  } catch (error) {
    console.error(`[Kafka] Failed to publish to ${topic}:`, error);
  }
};
