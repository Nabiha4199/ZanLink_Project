import { useState } from "react";

const roles = ["Engineer", "Sales", "HOC", "Accounts", "Store", "Management", "HOD", "System Admin"];
const emptyUser = { name: "", email: "", role: "Engineer", password: "" };

export default function UserManagementPage({ currentUser, users, onCreateUser, onUpdateUser, onDeleteUser }) {
  const [pending, setPending] = useState("");
  const [form, setForm] = useState(emptyUser);

  async function updateUser(userId, changes) {
    setPending(userId);
    try {
      await onUpdateUser(userId, changes);
    } finally {
      setPending("");
    }
  }

  async function createUser(event) {
    event.preventDefault();
    setPending("create");
    try {
      await onCreateUser(form);
      setForm(emptyUser);
    } finally {
      setPending("");
    }
  }

  async function deleteUser(account) {
    if (!window.confirm(`Delete ${account.name}'s account? This cannot be undone.`)) return;
    setPending(account.id);
    try {
      await onDeleteUser(account.id);
    } finally {
      setPending("");
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title"><h1>User Management</h1><p>Microsoft registrations wait here for a System Admin to assign a role and approve access. System Admins can also revoke or permanently delete accounts.</p></div>
      </div>
      <form className="panel" onSubmit={createUser}>
        <div className="section-title"><h2>Add User</h2><span>The current admin stays signed in.</span></div>
        <div className="form-grid">
          <label>Full Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>Role<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
          <label>Password (optional)<input minLength="8" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><small>Leave empty for Microsoft-only sign-in.</small></label>
        </div>
        <div className="button-row"><button className="btn" disabled={pending === "create"}>Create user</button></div>
      </form>
      <section className="panel">
        <div className="section-title"><h2>Accounts</h2><span>{users.length} user{users.length === 1 ? "" : "s"}</span></div>
        {!users.length ? <div className="empty">Loading users...</div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Username</th><th>Role</th><th>Sign-in</th><th>Access</th><th>Actions</th></tr></thead>
              <tbody>{users.map((account) => {
                const isCurrentUser = account.id === currentUser.id;
                return (
                  <tr key={account.id}>
                    <td><strong>{account.name}</strong>{isCurrentUser && <small> (you)</small>}</td>
                    <td>{account.email}</td>
                    <td>{account.username}</td>
                    <td>
                      <select
                        aria-label={`Role for ${account.email}`}
                        disabled={isCurrentUser || pending === account.id}
                        value={account.role === "Head of Department" ? "HOD" : account.role}
                        onChange={(event) => updateUser(account.id, { role: event.target.value })}
                      >
                        {account.pendingApproval && account.role === "Pending Approval" && <option value="Pending Approval" disabled>Select a role</option>}
                        {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                      </select>
                    </td>
                    <td>{account.pendingApproval ? "Awaiting approval" : account.microsoftLinked ? "Microsoft" : account.hasPassword ? "Password" : "Microsoft required"}</td>
                    <td>
                      <button
                        className={account.active ? "btn danger" : "btn secondary"}
                        disabled={isCurrentUser || pending === account.id}
                        type="button"
                        onClick={() => updateUser(account.id, account.pendingApproval ? { active: true, approve: true } : { active: !account.active })}
                      >
                        {account.pendingApproval ? "Approve" : account.active ? "Revoke" : "Restore"}
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn danger"
                        disabled={isCurrentUser || pending === account.id}
                        type="button"
                        onClick={() => deleteUser(account)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
