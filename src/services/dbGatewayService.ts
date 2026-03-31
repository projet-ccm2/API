import axios from "axios";
import { environment } from "../config/environment";
import { buildDbGatewayHeaders } from "./vpcTokenService";

type AchievedPayload = {
  achievementId: string;
  userId: string;
  count: number;
  finished: boolean;
  labelActive: boolean;
  acquiredDate: string;
};

export class AlreadyAchievedError extends Error {
  constructor() {
    super("Achievement already validated for this user");
    this.name = "AlreadyAchievedError";
  }
}

function getStatus(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { status?: unknown } }).response?.status ===
      "number"
  ) {
    return (error as { response: { status: number } }).response.status;
  }
  return undefined;
}

export async function insertAchieved(payload: AchievedPayload): Promise<void> {
  try {
    const headers = await buildDbGatewayHeaders();
    await axios.post(`${environment.dbGatewayUrl}/achieved`, payload, {
      headers,
      timeout: 8_000,
    });
  } catch (error: unknown) {
    if (getStatus(error) === 409) {
      throw new AlreadyAchievedError();
    }
    throw error;
  }
}
