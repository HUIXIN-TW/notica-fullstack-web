import "server-only";
import logger from "@utils/shared/logger";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "@utils/server/db-client";
import { encryptToken, decryptToken } from "@utils/server/token-crypto";

const TABLE_NAME = process.env.DYNAMODB_NOTION_OAUTH_TOKEN_TABLE;
const USER_TABLE_NAME = process.env.DYNAMODB_USER_TABLE;

export const updateNotionTokens = async (
  uuid,
  accessToken,
  workspaceId,
  duplicatedTemplateId,
  updatedAt,
) => {
  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            ConditionCheck: {
              TableName: USER_TABLE_NAME,
              Key: { uuid },
              ConditionExpression: "attribute_exists(#uuid)",
              ExpressionAttributeNames: {
                "#uuid": "uuid",
              },
            },
          },
          {
            Update: {
              TableName: TABLE_NAME,
              Key: { uuid },
              UpdateExpression:
                "SET accessToken = :accessToken, workspaceId = :workspaceId, duplicatedTemplateId = :duplicatedTemplateId, updatedAt = :updatedAt",
              ExpressionAttributeValues: {
                ":accessToken": encryptToken(accessToken),
                ":workspaceId": workspaceId,
                ":duplicatedTemplateId": duplicatedTemplateId,
                ":updatedAt": updatedAt,
              },
            },
          },
        ],
      }),
    );
  } catch (error) {
    logger.error("Failed to update Notion tokens", error);
    throw error;
  }
};

// get token by uuid
export const getNotionTokensByUuid = async (uuid) => {
  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { uuid },
      }),
    );
    const item = result.Item;
    if (item?.accessToken) {
      item.accessToken = decryptToken(item.accessToken);
    }
    return item;
  } catch (error) {
    logger.error("Error getting Notion tokens by UUID", error);
    throw error;
  }
};
