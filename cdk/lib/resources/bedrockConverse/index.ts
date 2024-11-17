import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  Message,
} from "@aws-sdk/client-bedrock-runtime";
import { prompt } from "./prompt";

export async function converseStreamWithModel(
  region: string,
  modelId: string,
  messages: Message[]
) {
  const bedrockClient = new BedrockRuntimeClient({
    region: region,
  });
  const conversation: Message[] = messages;

  const command = new ConverseStreamCommand({
    modelId,
    messages: conversation,
    system: [{ text: prompt }],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.5,
      topP: 0.9,
    },
  });

  try {
    const response = await bedrockClient.send(command);
    return response;
  } catch (err) {
    console.error(`ERROR: Can't invoke '${modelId}'. Reason: ${err}`);
    throw new Error("Failed to invoke model");
  }
}

export async function converseWithModel(
  region: string,
  modelId: string,
  messages: Message[]
) {
  const bedrockClient = new BedrockRuntimeClient({
    region: region,
  });
  const conversation: Message[] = messages;

  const command = new ConverseCommand({
    modelId,
    messages: conversation,
    system: [{ text: prompt }],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.5,
      topP: 0.9,
    },
  });

  try {
    const response = await bedrockClient.send(command);
    return response;
  } catch (err) {
    console.error(`ERROR: Can't invoke '${modelId}'. Reason: ${err}`);
    throw new Error("Failed to invoke model");
  }
}
