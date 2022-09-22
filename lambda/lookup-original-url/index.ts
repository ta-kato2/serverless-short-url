import { APIGatewayProxyEvent, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

type RequestBody = {
  hash: string;
};

exports.handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResultV2> => {
  const hash = (event.queryStringParameters as RequestBody).hash;
  const urlMappingRecord = await selectDB(hash);
  if (!urlMappingRecord.Item) {
    return {
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Origin": "*", //TODO
      },
    };
  }
  return {
    statusCode: 301,
    headers: {
      location: urlMappingRecord.Item?.ORIGINAL_URL.S!,
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Origin": "*", //TODO
    },
  };
};

const selectDB = async (shortUrlHash: string) => {
  const dynamoDBClient = new DynamoDBClient({});
  return await dynamoDBClient.send(
    new GetItemCommand({
      TableName: "URL_MAPPING",
      Key: {
        SHORT_URL_HASH: { S: shortUrlHash },
      },
    })
  );
};
