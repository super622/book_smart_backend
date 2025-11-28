const { verifyUser } = require("../utils/verifyToken.js");

module.exports = app => {
  const terms = require("../controllers/terms.controller.js");

  var router = require("express").Router();

  // Public route - Get published terms (for clinicians)
  router.get("/published", terms.getPublishedTerms);

  // Admin routes - require authentication
  router.get("/all", verifyUser, terms.getAllTerms);
  router.get("/overview", verifyUser, terms.getTermsOverview);
  router.get("/draft", verifyUser, terms.getDraftTerms);
  router.get("/:id", verifyUser, terms.getTermsById);
  router.post("/save-draft", verifyUser, terms.saveDraftTerms);
  router.post("/publish", verifyUser, terms.publishTerms);
  router.post("/create", verifyUser, terms.createTerms);
  router.put("/:id", verifyUser, terms.updateTerms);
  router.delete("/:id", verifyUser, terms.deleteTerms);
  router.post("/acknowledge", verifyUser, terms.acknowledgeNewTerms);
  router.get("/status", verifyUser, terms.getTermsStatus); // Admin only - get terms status for all users
  router.post("/test-notification", terms.testFCMNotification); // Public test endpoint

  app.use("/api/terms", router);
};

