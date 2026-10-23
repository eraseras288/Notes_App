import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { errorHandler, logger, notFound } from "./middleware";
import { router } from "./routes";
import { swaggerSpec } from "./swagger";

const app = express();
app.use(cors());
app.use(express.json());
app.use(logger);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api", router);
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`API: http://localhost:${port}  |  Swagger: http://localhost:${port}/api-docs`));
