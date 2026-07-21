import { getDb } from "../server/db";
import { purchaseRequests, requestItems } from "../drizzle/schema";
import { eq, like } from "drizzle-orm";

async function main() {
  const db = await getDb();
  const req = await db.select({
    id: purchaseRequests.id,
    requestNumber: purchaseRequests.requestNumber,
    status: purchaseRequests.status,
  }).from(purchaseRequests).where(like(purchaseRequests.requestNumber, "%0563%")).limit(1);
  console.log("Request:", JSON.stringify(req, null, 2));
  if (req[0]) {
    const items = await db.select({
      id: requestItems.id,
      description: requestItems.description,
      itemStatus: requestItems.itemStatus,
    }).from(requestItems).where(eq(requestItems.requestId, req[0].id));
    console.log("Items:", JSON.stringify(items, null, 2));
  }
}
main().catch(console.error).finally(() => process.exit(0));
