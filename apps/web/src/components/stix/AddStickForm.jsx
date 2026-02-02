import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './AddStickForm.module.css';
import apiClient from '../../services/apiClient.jsx';

// Options per Stick schema enums
const STICK_LOCATIONS = ['Stomach', 'Arm', 'Thigh', 'Other'];
const STICK_LOC_MODS = ['Left', 'Right', 'Upper', 'Upper Left', 'Upper Right', 'Lower', 'Lower Left', 'Lower Right'];

/**
 * AddStickForm Component
 * A controlled form for creating a new Stick on a given Stickerboard.
 * 
 * @param {Object} props - Component properties
 * @param {string|number} props.boardId - Stickerboard ID to attach the new stick to
 * @param {Function} [props.onCreated] - Called with the created stick on success
 * @param {Function} [props.onCancel] - Called if user clicks cancel
 * @param {string} [props.title='Add a new Stick'] - Heading for the form
 * @param {number} [props.nextStickNumber] - The number to assign to the new stick
 */
export default function AddStickForm({ boardId, onCreated, onCancel, title = 'Add a new Stick', nextStickNumber, className }) {
  const [values, setValues] = useState({
    stickNumber: '',
    stickMed: '',
    stickDose: 2.5,
    stickLocation: '',
    stickLocMod: '',
    description: '',
    cost: 0,
    userDate: '', // yyyy-mm-dd
    userTime: '', // HH:mm
  });

  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'info'

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'error'|'success', message: string }

  // Keep stickNumber in sync with provided nextStickNumber; it's auto-assigned and non-editable
  useEffect(() => {
    if (typeof nextStickNumber === 'number' && !isNaN(nextStickNumber)) {
      setValues((v) => (v.stickNumber === nextStickNumber ? v : { ...v, stickNumber: nextStickNumber }));
    }
  }, [nextStickNumber]);

  // Fetch last stick to prepopulate defaults
  useEffect(() => {
    async function fetchLastStick() {
      try {
        // Fetch all stix for this board to find the latest one
        const response = await apiClient.get(`/stickerboards/${encodeURIComponent(boardId)}/stix`);
        const result = response.data || response;
        // The API might return { success: true, count: X, seed-data: [...] } or just the array
        const stix = Array.isArray(result) ? result : result.data;
        
        if (Array.isArray(stix) && stix.length > 0) {
          // stix are sorted by stickNumber: 1 in controller, so last one is most recent
          const lastStick = stix[stix.length - 1];
          setValues(v => ({
            ...v,
            stickMed: lastStick.stickMed || v.stickMed,
            stickDose: lastStick.stickDose != null ? lastStick.stickDose : v.stickDose,
          }));
        }
      } catch (err) {
        console.error('Failed to fetch last stick for defaults:', err);
      }
    }
    if (boardId) {
      fetchLastStick();
    }
  }, [boardId]);

  const canSubmit = useMemo(() => {
    // Basic web-side requirements: Medicine and Dose are now the only mandatory fields
    return (
      values.stickMed &&
      values.stickDose !== '' &&
      values.stickDose != null &&
      !submitting
    );
  }, [values, submitting]);

  function update(field, toNumber = false) {
    return (e) => {
      const raw = e?.target?.value;
      const next = toNumber ? (raw === '' ? '' : Number(raw)) : raw;
      setValues((v) => ({ ...v, [field]: next }));
    };
  }

  function validate() {
    const errs = {};
    // Location, LocMod, and Description are no longer mandatory

    // Optional numeric validations consistent with schema
    if (values.cost !== '' && (isNaN(values.cost) || values.cost < 0 || values.cost > 9999)) {
      errs.cost = 'Cost must be between 0 and 9999';
    }
    if (values.stickDose !== '' && isNaN(values.stickDose)) {
      errs.stickDose = 'Dose must be a number';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      // Convert date/time to ISO-ish fields if provided, otherwise default to "now"
      const body = { ...values };
      const now = new Date();

      if (values.userDate) {
        body.userDate = new Date(values.userDate);
      } else {
        // Default to today
        body.userDate = now;
      }

      if (values.userTime) {
        const [hh, mm] = String(values.userTime).split(':');
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(hh || 0), Number(mm || 0));
        body.userTime = d;
      } else {
        // Default to current time
        body.userTime = now;
      }

      // Clean empty optional fields (stickNumber is auto-assigned and should be retained)
      ['stickMed', 'stickLocation', 'stickLocMod', 'description'].forEach((k) => {
        if (body[k] === '' || body[k] == null) delete body[k];
      });

      const response = await apiClient.post(`/stix/${encodeURIComponent(boardId)}`, body);

      // apiClient interceptor returns response.seed-data
      const created = response.data || response;
      setStatus({ type: 'success', message: 'Stick created successfully.' });
      if (onCreated) onCreated(created);
      // Optionally reset fields except some defaults
      setValues((v) => ({
        ...v,
        // stickMed: '', // Don't reset medicine, keep it for next entry
        description: '',
        userDate: '',
        userTime: '',
        // keep dose, cost, location selections as-is for faster consecutive entries
      }));
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || String(err);
      setStatus({ type: 'error', message: errorMsg });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${styles.form} ${className || ''}`}>
      {title && <h3 className={styles.title}>{title}</h3>}

      <div className={styles.tabs}>
        <button
          type="button"
          className={activeTab === 'new' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('new')}
        >
          New Stick
        </button>
        <button
          type="button"
          className={activeTab === 'info' ? styles.activeTab : styles.tab}
          onClick={() => setActiveTab('info')}
        >
          Additional Info
        </button>
      </div>

      <div className={styles.grid}>
        {activeTab === 'new' && (
          <>
            {/* Medicine and number */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="stickMed">Medicine</label>
              <input id="stickMed" className={styles.input} type="text" placeholder="e.g., Ozempic"
                     value={values.stickMed} onChange={update('stickMed')} maxLength={50} required />
              <div className={styles.help}>Required, up to 50 characters</div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="stickNumber">Stick Number</label>
              <input
                id="stickNumber"
                className={styles.input}
                type="number"
                inputMode="numeric"
                value={values.stickNumber}
                readOnly
                disabled
              />
              <div className={styles.help}>Auto-assigned as one more than the highest stick number on this board.</div>
            </div>

            {/* Dose */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="stickDose">Dose</label>
              <input id="stickDose" className={styles.input} type="number" step="0.1" inputMode="decimal"
                     value={values.stickDose}
                     onChange={update('stickDose', true)} required />
              {errors.stickDose && <div className={styles.errorText}>{errors.stickDose}</div>}
              <div className={styles.help}>Required</div>
            </div>

            {/* Date/Time */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="userDate">Date (optional)</label>
              <input id="userDate" className={styles.input} type="date"
                     value={values.userDate}
                     onChange={update('userDate')} />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="userTime">Time (optional)</label>
              <input id="userTime" className={styles.input} type="time"
                     value={values.userTime}
                     onChange={update('userTime')} />
            </div>
          </>
        )}

        {activeTab === 'info' && (
          <>
            {/* Location */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="stickLocation">Location</label>
              <select id="stickLocation" className={styles.select}
                      value={values.stickLocation}
                      onChange={update('stickLocation')}>
                <option value="">Select location…</option>
                {STICK_LOCATIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Location modifier */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="stickLocMod">Location modifier</label>
              <select id="stickLocMod" className={styles.select}
                      value={values.stickLocMod}
                      onChange={update('stickLocMod')}>
                <option value="">Select modifier…</option>
                {STICK_LOC_MODS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Cost */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="cost">Cost</label>
              <input id="cost" className={styles.input} type="number" inputMode="decimal" step="0.01" min="0"
                     value={values.cost}
                     onChange={update('cost', true)} />
              {errors.cost && <div className={styles.errorText}>{errors.cost}</div>}
            </div>

            {/* Description */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="description">Description</label>
              <textarea id="description" className={styles.textarea} placeholder="Describe this stick"
                        maxLength={500}
                        value={values.description}
                        onChange={update('description')} />
            </div>
          </>
        )}
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.buttonPrimary} disabled={!canSubmit}>
          {submitting ? 'Adding…' : 'Add Stick'}
        </button>
        {onCancel && (
          <button type="button" className={styles.buttonSecondary} onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
      </div>

      {status && (
        <div className={`${styles.status} ${status.type === 'error' ? styles.statusError : styles.statusSuccess}`}>
          {status.message}
        </div>
      )}
    </form>
  );
}

AddStickForm.propTypes = {
  boardId: PropTypes.string.isRequired,
  onCreated: PropTypes.func,
  onCancel: PropTypes.func,
  title: PropTypes.string,
  nextStickNumber: PropTypes.number,
};
