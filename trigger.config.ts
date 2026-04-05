import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_cvsczaunrwapetwrhivf",
  dirs: ["./src/trigger"],
  maxDuration: 300, // 5 minutes max per task run
});
