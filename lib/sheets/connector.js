/**
 * Legacy import compatibility wrapper.
 * New storage is Neon Postgres via lib/db/connector.js.
 */

export {
  getAllRows,
  appendRow,
  updateRow,
  deleteRow,
  getSheetMeta,
} from "../db/connector";
