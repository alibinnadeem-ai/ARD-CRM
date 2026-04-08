/**
 * components/records/RecordForm.jsx
 * Shared form for Create and Edit operations
 */
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  STATUS_OPTIONS,
  STAGE_OPTIONS,
  SOURCE_OPTIONS,
} from "../../lib/transforms/mapper";

const EMPTY = {
  name: "", company: "", email: "", phone: "",
  status: "New Lead", stage: "Awareness", source: "",
  assigned_to: "", value: "", city: "", follow_up: "",
  notes: "", tags: "",
};

function normalizeInitial(initial = {}) {
  const merged = { ...EMPTY, ...initial };
  const normalized = {};

  for (const [key, value] of Object.entries(merged)) {
    normalized[key] = value == null ? "" : String(value);
  }

  return normalized;
}

function RecordForm({ initial = {}, onSubmit, onCancel, loading }) {
  const recordIdentity = useMemo(
    () => initial?.id || initial?._rowIndex || "new-record",
    [initial?.id, initial?._rowIndex]
  );
  const stableInitial = useMemo(() => normalizeInitial(initial), [recordIdentity]);
  const [form, setForm] = useState(() => normalizeInitial(initial));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(stableInitial);
    setErrors({});
  }, [recordIdentity, stableInitial]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((f) => {
      if (f[name] === value) return f;
      return { ...f, [name]: value };
    });
    setErrors((er) => {
      if (!er[name] && !er._base) return er;
      return { ...er, [name]: null, _base: null };
    });
  }, []);

  function validate() {
    const err = {};
    if (!form.name.trim() && !form.email.trim() && !form.phone.trim()) {
      err._base = "At least one of Name, Email, or Phone is required.";
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      err.email = "Enter a valid email address.";
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Base error */}
      {errors._base && (
        <div style={{
          background: "#fee2e2", border: "1px solid #fecaca",
          borderRadius: 8, padding: "12px 16px",
          color: "#991b1b", fontSize: 13.5,
        }}>{errors._base}</div>
      )}

      {/* Section: Contact Info */}
      <Section title="Contact Information">
        <div className="form-grid">
          <Field label="Full Name" error={errors.name}>
            <input className="input" name="name" placeholder="e.g. Ahmed Raza" value={form.name} onChange={handleChange} />
          </Field>
          <Field label="Company / Project" error={errors.company}>
            <input className="input" name="company" placeholder="e.g. ARD City Block A" value={form.company} onChange={handleChange} />
          </Field>
          <Field label="Email Address" error={errors.email}>
            <input className="input" name="email" type="email" placeholder="client@email.com" value={form.email} onChange={handleChange} />
          </Field>
          <Field label="Phone / Mobile" error={errors.phone}>
            <input className="input" name="phone" type="tel" placeholder="+92 300 0000000" value={form.phone} onChange={handleChange} />
          </Field>
          <Field label="City / Area">
            <input className="input" name="city" placeholder="e.g. Islamabad" value={form.city} onChange={handleChange} />
          </Field>
          <Field label="Deal Value (PKR)">
            <input className="input" name="value" type="number" placeholder="e.g. 5000000" value={form.value} onChange={handleChange} />
          </Field>
        </div>
      </Section>

      {/* Section: Pipeline */}
      <Section title="Pipeline & Assignment">
        <div className="form-grid">
          <Field label="Status">
            <select className="input" name="status" value={form.status} onChange={handleChange}>
              {STATUS_OPTIONS.filter(s => s !== "Deleted").map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Stage">
            <select className="input" name="stage" value={form.stage} onChange={handleChange}>
              {STAGE_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Lead Source">
            <select className="input" name="source" value={form.source} onChange={handleChange}>
              <option value="">— Select Source —</option>
              {SOURCE_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Assigned To">
            <input className="input" name="assigned_to" placeholder="Agent / BDM name" value={form.assigned_to} onChange={handleChange} />
          </Field>
          <Field label="Follow-up Date">
            <input className="input" name="follow_up" type="date" value={form.follow_up} onChange={handleChange} />
          </Field>
          <Field label="Tags (comma-separated)">
            <input className="input" name="tags" placeholder="e.g. hot-lead, vip, referral" value={form.tags} onChange={handleChange} />
          </Field>
        </div>
      </Section>

      {/* Section: Notes */}
      <Section title="Notes & Remarks">
        <Field label="Notes">
          <textarea
            className="input"
            rows={4}
            placeholder="Add any relevant notes about this lead…"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            style={{ resize: "vertical", minHeight: 100 }}
          />
        </Field>
      </Section>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 8 }}>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? (
            <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</>
          ) : "Save Record"}
        </button>
      </div>
    </form>
  );
}

export default memo(RecordForm);

function Section({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.1em", color: "var(--text-muted)",
        paddingBottom: 12, marginBottom: 16,
        borderBottom: "1px solid var(--border)",
      }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
      {error && <span style={{ color: "var(--red)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
