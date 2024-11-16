import { converseStreamWithModel } from "./bedrockConverse";
import { ApiGatewayManagementApi } from "@aws-sdk/client-apigatewaymanagementapi";

const bedrockRegion = process.env.BEDROCK_REGION || "us-west-2";
const modelId =
  process.env.MODEL_ID || "anthropic.claude-3-5-sonnet-20240620-v1:0";

const sendMessageToClient = async (
  domainName: string,
  stage: string,
  connectionId: string,
  message: any
) => {
  const client = new ApiGatewayManagementApi({
    endpoint: `https://${domainName}/${stage}`,
    region: process.env.AWS_REGION,
  });

  try {
    await client.postToConnection({
      ConnectionId: connectionId,
      Data: message,
    });
  } catch (error) {
    console.error("Error sending message to client:", error);
    throw error;
  }
};

export const handler = async (event: any) => {
  console.log("Event:", event);

  const routeKey = event.requestContext.routeKey;
  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;

  try {
    switch (routeKey) {
      case "$connect":
        // Handle new WebSocket connection
        return { statusCode: 200, body: "Connected" };

      case "$disconnect":
        // Handle WebSocket disconnection
        return { statusCode: 200, body: "Disconnected" };

      default:
        // Handle chat messages
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
            await sendMessageToClient(domainName, stage, connectionId, {
              type: "message",
              content:
                JSON.stringify({
                  type: "chunk",
                  content: chunk.contentBlockDelta.delta.text,
                }) + "\n",
            });
          } else if (chunk.messageStop) {
            console.log("Stream stopped:", chunk.messageStop);
          } else if (chunk.metadata) {
            console.log("Metadata:", chunk.metadata);
          }
        }

        return {
          statusCode: 200,
          body: "Message processed successfully",
        };

      // default:
      //   return {
      //     statusCode: 400,
      //     body: "Unhandled route",
      //   };
    }
  } catch (error) {
    console.error("Error:", error);
    if (connectionId && domainName && stage) {
      try {
        await sendMessageToClient(domainName, stage, connectionId, {
          type: "error",
          content: "An error occurred while processing your request",
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
