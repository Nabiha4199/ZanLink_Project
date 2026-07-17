import React, { useEffect, useState } from "react";
import { api } from "../services/api";

const roles = [
  ["Engineer", "Engineer"],
  ["Sales", "Sales"],
  ["Accounts", "Accounts"],
  ["Store", "Store"],
  ["Management", "Management"],
  ["HOD", "Head of Department"],
];

export default function UserAccessPage({ showError }) {
  const [users, setUsers] = useState([]);
  const [busyId, setBusyId] = useState("");

  async function loadUsers() {
    try {
      setUsers(await api.users());
    } catch (error) {
      showError(error);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updateAccess(user, changes) {
    setBusyId(user.id);
    try {
      const updated = await api.updateUserAccess(user.id, changes);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      showError(error);
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">
          <span className="eyebrow">System administration</span>
          <h1>User Access</h1>
          <p>Approve registrations, assign the correct role, or revoke access.</p>
        </div>
      </div>
      <section className="panel">
        <div className="section-title"><h2>Registered accounts</h2><span>{users.length} users</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Requested role</th><th>Status</th><th>Access</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.name}</strong><br /><small>{user.email || "No email"}</small></td>
                  <td>
                    {user.role === "System Admin" ? user.role : (
                      <select
                        aria-label={`Role for ${user.name}`}
                        disabled={busyId === user.id}
                        value={roleValue(user)}
                        onChange={(event) => updateAccess(user, { role: event.target.value })}
                      >
                        {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    )}
                  </td>
                  <td><span className={`access-status access-${user.status}`}>{user.status}</span></td>
                  <td>
                    <div className="button-row access-actions">
                      {user.status !== "active" && <button className="btn" disabled={busyId === user.id} onClick={() => updateAccess(user, { status: "active" })}>Approve</button>}
                      {user.status === "active" && user.role !== "System Admin" && <button className="btn secondary" disabled={busyId === user.id} onClick={() => updateAccess(user, { status: "disabled" })}>Disable</button>}
                      {user.status === "disabled" && <button className="btn secondary" disabled={busyId === user.id} onClick={() => updateAccess(user, { status: "pending" })}>Set pending</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function roleValue(user) {
  if (user.role === "Head of Department") return "HOD";
  return user.role;
}
