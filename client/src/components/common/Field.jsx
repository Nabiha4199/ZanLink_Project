import React from "react";

export default function Field({ label, value }) {
  return <div className="paper-field"><span>{label}</span><strong>{value || "-"}</strong></div>;
}
