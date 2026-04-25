const { ZodError } = require("zod");

function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message
      }))
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid identifier provided"
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Email already in use"
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal server error"
  });
}

module.exports = { notFound, errorHandler };
