import { converseWithModel } from "./bedrockConverse";

const bedrockRegion = process.env.BEDROCK_REGION || "us-west-2";
const modelId =
  process.env.MODEL_ID || "anthropic.claude-3-5-sonnet-20240620-v1:0";

export const handler = async (event: any) => {
  console.log(event);
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const messages = body.messages || [
      { role: "user", content: [{ text: "hello" }] },
    ];
    const response = await converseWithModel(bedrockRegion, modelId, messages);
    console.log(response);
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "OPTIONS,POST",
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error invoking Bedrock model:", error);
    return {
      statusCode: 500,
      body: "Internal server error",
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:5173", // Match your frontend origin
        "Access-Control-Allow-Credentials": true,
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "OPTIONS,POST",
      },
    };
  }
};
