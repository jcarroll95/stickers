import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import apiClient from '../../services/apiClient.jsx';
import { parseError } from '../../utils/errorUtils.js';
import styles from './AddLogEntryForm.module.css';

const getTitle = (type) => {
  switch (type) {
    case 'weight': return 'Current Weight (lbs/kg)';
    case 'nsv': return 'Non-Scale Victory Details';
    case 'note': return 'Notes / Thoughts';
    case 'mood': return 'How are you feeling?';
    case 'sleep': return 'How did you sleep?';
    case 'activity': return 'What activity did you do?';
    case 'side-effect': return 'Describe any side effects';
    default: return 'Details';
  }
};

const getPlaceholder = (type) => {
  switch (type) {
    case 'weight': return 'e.g. 185.5';
    case 'nsv': return 'Describe your victory...';
    case 'note': return 'Write a note...';
    case 'mood': return 'e.g. Feeling energetic, a bit tired...';
    case 'sleep': return 'e.g. 7 hours, restful, woke up once...';
    case 'activity': return 'e.g. 30 min walk, gym session...';
    case 'side-effect': return 'e.g. Slight nausea, headache...';
    default: return 'Enter details...';
  }
};

export default function AddLogEntryForm({ boardId, type, onCreated, onCancel }) {
  const [value, setValue] = useState('');
  const [rating, setRating] = useState(3);
  const [userDate, setUserDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const showRating = ['mood', 'sleep', 'activity', 'side-effect'].includes(type);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (type === 'weight' && (!value || value.trim() === '')) {
      return toast.error('Please enter a weight');
    }

    setSubmitting(true);
    const toastId = toast.loading(`Saving ${type}...`);

    try {
      let finalContent = value.trim();
      if (showRating) {
        // If they enter just the text and don't click the number button, it should default to 3
        // If they input just the 1-5 button, that corresponding number should be the string.
        // If they input the 1-5 button and text, the string should begin with that corresponding number and then the text
        finalContent = finalContent ? `${rating}, ${finalContent}` : `${rating}`;
      }

      const payload = {
        type,
        [type === 'weight' ? 'weight' : 'content']: type === 'weight' ? Number(value) : finalContent,
        userDate: new Date(userDate)
      };

      // Note: We use the boardId from the parent BoardView
      const res = await apiClient.post(`/stickerboards/${boardId}/logs`, payload);

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} logged!`, { id: toastId });

      // Pass the resulting data back to BoardView to refresh the UI
      onCreated(res);
    } catch (err) {
      console.error('Failed to save log entry:', err);
      toast.error(parseError(err), { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {showRating && (
        <div className={styles.field}>
          <label className={styles.label}>
            Rating (1-5, where 5 is best)
          </label>
          <div className={styles.ratingGroup}>
            {[1, 2, 3, 4, 5].map((num) => (
              <button
                key={num}
                type="button"
                className={`${styles.ratingButton} ${rating === num ? styles.activeRating : ''}`}
                onClick={() => setRating(num)}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label}>
          {getTitle(type)}
        </label>

        {type === 'weight' ? (
          <input
            type="number"
            step="0.1"
            className={styles.input}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={getPlaceholder(type)}
            autoFocus
          />
        ) : (
          <textarea
            className={styles.textarea}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={getPlaceholder(type)}
            autoFocus
          />
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>
          Date of Entry
        </label>
        <input
          type="date"
          className={styles.input}
          value={userDate}
          onChange={e => setUserDate(e.target.value)}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.buttonCancel}
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={styles.buttonSave}
          disabled={submitting}
        >
          {submitting ? 'Saving...' : 'Save Entry'}
        </button>
      </div>
    </form>
  );
}
