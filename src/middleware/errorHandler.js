const { ZodError } = require("zod");

function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error("=== ERROR HANDLER TRIGGERED ===");
  console.error("Error message:", err.message);
  console.error("Error status:", err.status);
  console.error("Error stack:", err.stack);

  // Prevent multiple responses
  if (res.headersSent) {
    console.error("Headers already sent, passing to next handler");
    return next(err);
  }

  try {
    if (err instanceof ZodError) {
      console.log("Zod validation error - returning 400");
      console.log("Validation errors:", err.errors);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: err.errors.map((e) => ({
          path: e.path.join("."),
          message: e.message,
          code: e.code
        }))
      });
    }

    if (err.name === "CastError") {
      console.log("CastError - returning 400");
      return res.status(400).json({
        success: false,
        message: "Invalid identifier provided"
      });
    }

    const status = err.status || 500;
    const message = err.message || "Internal server error";
    console.log(`Returning error response: status=${status}, message=${message}`);
    
    return res.status(status).json({
      success: false,
      message: message
    });
  } catch (jsonError) {
    console.error("Error sending JSON response:", jsonError);
    // Fallback response if JSON serialization fails
    return res.status(500).send("Internal Server Error");
  }
}

module.exports = { notFound, errorHandler };
