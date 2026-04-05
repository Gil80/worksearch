import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "<project-ref>", // TODO: replace with your project ref from cloud.trigger.dev
  dirs: ["./src/trigger"],
  maxDuration: 300, // 5 minutes max per task run
});
