import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    subject: { type: String, default: "" },
    message: { type: String, required: true },
    type: { type: String, enum: ["contact", "bulk_quote"], default: "contact" },
  },
  { timestamps: true }
);

export const ContactLead = mongoose.model("ContactLead", contactSchema);
