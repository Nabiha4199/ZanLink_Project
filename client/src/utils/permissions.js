export function canCreate(user) {
  return user.role === "Engineer" || user.role === "System Admin";
}

export function canAct(user, department) {
  return user.role === "System Admin" || user.department === department || user.role === department;
}

export function statusClass(status) {
  if (status === "Completed") return "done";
  if (status?.includes("Returned")) return "returned";
  return "";
}
