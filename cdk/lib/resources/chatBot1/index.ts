import { streamifyResponse, ResponseStream } from "lambda-stream";
import { converseStreamWithModel } from "./bedrockConverse";

const bedrockRegion = process.env.BEDROCK_REGION || "us-west-2";
const modelId =
  process.env.MODEL_ID || "anthropic.claude-3-5-sonnet-20240620-v1:0";

export const handler = streamifyResponse(
  async (event: any, streamResponse: ResponseStream) => {
    console.log(event);
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const messages = body.messages || [
        { role: "user", content: [{ text: "hello" }] },
      ];

      const responseStream = await converseStreamWithModel(
        bedrockRegion,
        modelId,
        messages
      );

      for await (const chunk of responseStream.stream!) {
        if (chunk.messageStart) {
          console.log("Stream started:", chunk.messageStart);
        } else if (chunk.contentBlockDelta?.delta?.text) {
          streamResponse.write(
            JSON.stringify({
              type: "chunk",
              content: chunk.contentBlockDelta.delta.text,
            }) + "\n"
          );
        } else if (chunk.messageStop) {
          console.log("Stream stopped:", chunk.messageStop);
        } else if (chunk.metadata) {
          console.log("Metadata:", chunk.metadata);
          streamResponse.write(
            JSON.stringify({
              type: "metadata",
              usage: chunk.metadata.usage,
              metrics: chunk.metadata.metrics,
            }) + "\n"
          );
        }
      }
    } catch (error) {
      console.error("Error invoking Bedrock model:", error);
      streamResponse.write(
        JSON.stringify({
          type: "error",
          error: "Failed to process request",
          message: error instanceof Error ? error.message : String(error),
        }) + "\n"
      );
    } finally {
      streamResponse.end();
    }
    return;
  }
);
