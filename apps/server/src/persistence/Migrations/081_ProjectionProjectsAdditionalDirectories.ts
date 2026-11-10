import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

// JSON array of absolute paths; empty means a single-folder project.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    ALTER TABLE projection_projects
    ADD COLUMN additional_directories_json TEXT NOT NULL DEFAULT '[]'
  `;
});
