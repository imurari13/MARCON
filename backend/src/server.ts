
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDB, mongoose } from "./db/index.js";

async function startServer(): Promise<void> {
  try {
    await connectDB();

    const app = createApp(mongoose.connection.getClient());

    const server = app.listen(env.PORT, () => {
      console.log(
        `MarcOn API listening on port ${env.PORT}`
      );
    });

    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${env.PORT} is already in use. Stop the other backend server or change PORT in backend/.env.`);
      } else {
        console.error("Failed to start HTTP server:", error);
      }

      // Do not disconnect here: Mongoose may still be creating indexes, and
      // closing its client races those operations (MongoExpiredSessionError).
      // The process is terminating because it never acquired the HTTP port.
      process.exit(1);
    });

    let isShuttingDown = false;

    async function shutdown(signal: string): Promise<void> {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`${signal} received; shutting down`);

      const forceExitTimer = setTimeout(() => {
        console.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000);

      forceExitTimer.unref();

      server.close(async (error) => {
        try {
          if (error) {
            console.error("HTTP server shutdown failed:", error);
            process.exitCode = 1;
          }

          await mongoose.disconnect();
          console.log("MongoDB disconnected");

          process.exit(process.exitCode ?? 0);
        } catch (shutdownError) {
          console.error("Shutdown failed:", shutdownError);
          process.exit(1);
        }
      });
    }

    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });
  } catch (error) {
    console.error("Failed to start MarcOn:", error);
    await mongoose.disconnect().catch(() => undefined);
    process.exitCode = 1;
  }
}

void startServer();
