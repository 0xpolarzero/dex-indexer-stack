import { beforeAll, describe, expect, it } from "vitest";
import { createClient, GqlClient } from "../src/index"


describe("query tests", () => {
  let gql: GqlClient;

  beforeAll(async () => {
    gql = await createClient({ url: "http://localhost:8080/v1/graphql", hasuraAdminSecret: "password" });
  });

  it("should have get all tokens query", async () => {
    const result = await gql.db.GetAllTokensQuery();

    expect(result.data?.token).toBeInstanceOf(Array);
    expect(result.data?.token.length).toBeGreaterThan(0);
  });
});
