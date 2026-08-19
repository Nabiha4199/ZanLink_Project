export function canCreate(user) {
  return user.role === "Engineer" || ["System Admin", "Management"].includes(user.role);
}

export function canCreateSurvey(user) {
  return user.role === "Sales" || user.department === "Sales" || ["System Admin", "Management"].includes(user.role);
}

export function canAct(user, department) {
  return ["System Admin", "Management"].includes(user.role) || user.department === department || user.role === department;
}

export function statusClass(status) {
  if (status === "Completed") return "done";
  if (status?.includes("Returned")) return "returned";
  return "";
}
