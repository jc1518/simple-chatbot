import { converseStreamWithModel } from "./bedrockConverse";
import {
  ApiGatewayManagementApi,
  GoneException,
} from "@aws-sdk/client-apigatewaymanagementapi";

const bedrockRegion = process.env.BEDROCK_REGION || "us-west-2";
const modelId =
  process.env.MODEL_ID || "anthropic.claude-3-5-sonnet-20240620-v1:0";

interface WebSocketMessage {
  type: "message" | "error";
  content: {
    type?: "chunk";
    content?: string;
    message?: string;
  };
}

const sendMessageToClient = async (
  domainName: string,
  stage: string,
  connectionId: string,
  message: WebSocketMessage,
  retries = 3
) => {
  const client = new ApiGatewayManagementApi({
    endpoint: `https://${domainName}/${stage}`,
    region: process.env.AWS_REGION,
  });

  let attempts = 0;

  while (attempts < retries) {
    try {
      const messageString = JSON.stringify(message);

      // Check if connection is still active
      try {
        await client.getConnection({ ConnectionId: connectionId });
      } catch (error) {
        if (error instanceof GoneException) {
          console.log(`Connection ${connectionId} is no longer available`);
          return false;
        }
        throw error;
      }

      await client.postToConnection({
        ConnectionId: connectionId,
        Data: messageString,
      });

      return true;
    } catch (error) {
      attempts++;

      if (error instanceof GoneException) {
        console.log(`Connection ${connectionId} is no longer available`);
        return false;
      }

      if (attempts === retries) {
        console.error(
          `Failed to send message after ${retries} attempts:`,
          error
        );
        throw error;
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 100 * attempts));
    }
  }
  return false;
};

export const handler = async (event: any) => {
  console.log("Event:", event);

  const routeKey = event.requestContext.routeKey;
  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  let isConnectionActive = true;

  try {
    switch (routeKey) {
      case "$connect":
        return { statusCode: 200, body: "Connected" };

      case "$disconnect":
        return { statusCode: 200, body: "Disconnected" };

      default:
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
          // Skip sending if connection is no longer active
          if (!isConnectionActive) break;

          if (chunk.messageStart) {
            console.log("Stream started:", chunk.messageStart);
          } else if (chunk.contentBlockDelta?.delta?.text) {
            const success = await sendMessageToClient(
              domainName,
              stage,
              connectionId,
              {
                type: "message",
                content: {
                  type: "chunk",
                  content: chunk.contentBlockDelta.delta.text,
                },
              }
            );

            // Update connection status
            if (!success) {
              isConnectionActive = false;
              break;
            }
          } else if (chunk.messageStop) {
            console.log("Stream stopped:", chunk.messageStop);
          } else if (chunk.metadata) {
            console.log("Metadata:", chunk.metadata);
          }
        }

        return {
          statusCode: isConnectionActive ? 200 : 410,
          body: isConnectionActive
            ? "Message processed successfully"
            : "Client connection no longer available",
        };
    }
  } catch (error) {
    console.error("Error:", error);
    if (connectionId && domainName && stage && isConnectionActive) {
      try {
        await sendMessageToClient(domainName, stage, connectionId, {
          type: "error",
          content: {
            message: "An error occurred while processing your request",
          },
        });
      } catch (sendError) {
        console.error("Error sending error message to client:", sendError);
      }
    }

    return {
      statusCode: 500,
      body: "Internal server error",
    };
  }
};
