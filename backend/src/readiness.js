// Presence checks only: never expose credentials or imply provider acceptance.
export function integrationReadiness(config, pdfReady) {
  const item = (id, label, fields, required = false) => {
    const present = fields.filter((key) => !!config[key]);
    return {
      id,
      label,
      required,
      status:
        present.length === fields.length
          ? "CONFIGURED"
          : present.length
            ? "PARTIAL"
            : "MISSING",
      missing: fields.filter((key) => !config[key]),
      verified: false,
    };
  };
  return {
    automaticReleaseApproved: false,
    integrations: [
      item(
        "storage",
        "Private answer storage",
        ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
        true,
      ),
      item("email", "Password reset email", ["SMTP_URL", "MAIL_FROM"], true),
      item("ai", "AI answer evaluation", ["AI_API_KEY", "AI_MODEL"], true),
      item("ocr", "Handwriting OCR", ["OCR_API_KEY"]),
      item("phone", "Phone OTP", [
        "TWILIO_ACCOUNT_SID",
        "TWILIO_AUTH_TOKEN",
        "TWILIO_VERIFY_SERVICE_SID",
      ]),
      item("payments", "Payments and subscriptions", [
        "RAZORPAY_KEY_ID",
        "RAZORPAY_KEY_SECRET",
        "RAZORPAY_WEBHOOK_SECRET",
      ]),
      {
        id: "pdf",
        label: "PDF answer sheets",
        status: pdfReady ? "AVAILABLE" : "MISSING",
        missing: pdfReady ? [] : ["poppler-utils", "util-linux (Linux)"],
        verified: false,
      },
    ],
    acceptanceRequired: [
      "Approve current-session syllabus, questions and board patterns",
      "Calibrate AI marks against independent teacher scores",
      "Test configured providers with client sandbox accounts",
      "Complete staging load, soak and backup restore checks",
      "Sign Android release and test physical devices",
    ],
  };
}
