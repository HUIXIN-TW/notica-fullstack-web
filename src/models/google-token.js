import "server-only";
import logger from "@utils/shared/logger";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "@utils/server/db-client";
import { encryptToken, decryptToken } from "@utils/server/token-crypto";

const TABLE_NAME = process.env.DYNAMODB_GOOGLE_OAUTH_TOKEN_TABLE;
const USER_TABLE_NAME = process.env.DYNAMODB_USER_TABLE;

export const updateGoogleTokens = async (
  uuid,
  accessToken,
  refreshToken,
  expiryDate,
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
              UpdateExpression: `
                SET accessToken = :accessToken,
                    refreshToken = :refreshToken,
                    expiryDate = :expiryDate,
                    updatedAt = :now
              `,
              ExpressionAttributeValues: {
                ":accessToken": encryptToken(accessToken),
                ":refreshToken": encryptToken(refreshToken),
                ":expiryDate": expiryDate,
                ":now": updatedAt,
              },
            },
          },
        ],
      }),
    );
  } catch (error) {
    logger.error("Error updating Google tokens", error);
    throw error;
  }
};

// get token by uuid
export const getGoogleTokensByUuid = async (uuid) => {
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
    if (item?.refreshToken) {
      item.refreshToken = decryptToken(item.refreshToken);
    }
    return item;
  } catch (error) {
    logger.error("Error getting Google tokens by UUID", error);
    throw error;
  }
};
