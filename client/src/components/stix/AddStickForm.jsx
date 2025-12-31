import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './AddStickForm.module.css';
import apiClient from '../../services/apiClient';

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
export default function AddStickForm({ boardId, onCreated, onCancel, title = 'Add a new Stick', nextStickNumber }) {
  const [values, setValues] = useState({
    stickNumber: '',
    stickMed: '',
    stickDose: 2.5,
    stickLocation: '',
    stickLocMod: '',
    description: '',
    nsv: '',
    weight: '',
    cost: 0,
    userDate: '', // yyyy-mm-dd
    userTime: '', // HH:mm
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'error'|'success', message: string }

  // Keep stickNumber in sync with provided nextStickNumber; it's auto-assigned and non-editable
  useEffect(() => {
    if (typeof nextStickNumber === 'number' && !isNaN(nextStickNumber)) {
      setValues((v) => (v.stickNumber === nextStickNumber ? v : { ...v, stickNumber: nextStickNumber }));
    }
  }, [nextStickNumber]);

  const canSubmit = useMemo(() => {
    // Basic client-side requirements
    return (
      values.stickLocation &&
      values.stickLocMod &&
      values.description.trim().length > 0 &&
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
    if (!values.stickLocation) errs.stickLocation = 'Location is required';
    if (!values.stickLocMod) errs.stickLocMod = 'Location modifier is required';
    if (!values.description || values.description.trim().length === 0) errs.description = 'Description is required';

    // Optional numeric validations consistent with schema
    if (values.weight !== '' && (isNaN(values.weight) || values.weight < 0 || values.weight > 999)) {
      errs.weight = 'Weight must be between 0 and 999';
    }
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
      // Convert date/time to ISO-ish fields if provided
      const body = { ...values };
      if (values.userDate) {
        // keep as date-only; backend expects Date, this will be parsed if needed
        body.userDate = new Date(values.userDate);
      } else {
        delete body.userDate;
      }
      if (values.userTime) {
        // store today with given time if only time provided
        const now = new Date();
        const [hh, mm] = String(values.userTime).split(':');
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(hh || 0), Number(mm || 0));
        body.userTime = d;
      } else {
        delete body.userTime;
      }

      // Clean empty optional fields (stickNumber is auto-assigned and should be retained)
      ['stickMed', 'nsv', 'weight'].forEach((k) => {
        if (body[k] === '' || body[k] == null) delete body[k];
      });

      const response = await apiClient.post(`/stix/${encodeURIComponent(boardId)}`, body);

      // apiClient interceptor returns response.data
      const created = response.data || response;
      setStatus({ type: 'success', message: 'Stick created successfully.' });
      if (onCreated) onCreated(created);
      // Optionally reset fields except some defaults
      setValues((v) => ({
        ...v,
        stickMed: '',
        description: '',
        nsv: '',
        weight: '',
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
    <form onSubmit={handleSubmit} className={styles.form}>
      {title && <h3 className={styles.title}>{title}</h3>}

      <div className={styles.grid}>
        {/* Medicine and number */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="stickMed">Medicine</label>
          <input id="stickMed" className={styles.input} type="text" placeholder="e.g., Ozempic"
                 value={values.stickMed} onChange={update('stickMed')} maxLength={50} />
          <div className={styles.help}>Optional, up to 50 characters</div>
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
                 onChange={update('stickDose', true)} />
          {errors.stickDose && <div className={styles.errorText}>{errors.stickDose}</div>}
        </div>

        {/* Location */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="stickLocation">Location<span style={{color:'#b91c1c'}}> *</span></label>
          <select id="stickLocation" className={styles.select}
                  value={values.stickLocation}
                  onChange={update('stickLocation')}>
            <option value="">Select location…</option>
            {STICK_LOCATIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {errors.stickLocation && <div className={styles.errorText}>{errors.stickLocation}</div>}
        </div>

        {/* Location modifier */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="stickLocMod">Location modifier<span style={{color:'#b91c1c'}}> *</span></label>
          <select id="stickLocMod" className={styles.select}
                  value={values.stickLocMod}
                  onChange={update('stickLocMod')}>
            <option value="">Select modifier…</option>
            {STICK_LOC_MODS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {errors.stickLocMod && <div className={styles.errorText}>{errors.stickLocMod}</div>}
        </div>

        {/* Weight */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="weight">Weight (optional)</label>
          <input id="weight" className={styles.input} type="number" inputMode="decimal" step="0.1"
                 value={values.weight}
                 onChange={update('weight', true)} />
          {errors.weight && <div className={styles.errorText}>{errors.weight}</div>}
        </div>

        {/* Cost */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="cost">Cost</label>
          <input id="cost" className={styles.input} type="number" inputMode="decimal" step="0.01" min="0"
                 value={values.cost}
                 onChange={update('cost', true)} />
          {errors.cost && <div className={styles.errorText}>{errors.cost}</div>}
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

        {/* Description */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="description">Description<span style={{color:'#b91c1c'}}> *</span></label>
          <textarea id="description" className={styles.textarea} placeholder="Describe this stick"
                    maxLength={500}
                    value={values.description}
                    onChange={update('description')} />
          {errors.description && <div className={styles.errorText}>{errors.description}</div>}
        </div>

        {/* NSV */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="nsv">NSV (optional)</label>
          <textarea id="nsv" className={styles.textarea} placeholder="Non-scale victories, notes"
                    maxLength={500}
                    value={values.nsv}
                    onChange={update('nsv')} />
        </div>
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
