// apps/web/src/components/admin/AssetIngestion.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './AssetIngestion.module.css';
import apiClient from '../../services/apiClient.jsx';

const fmtDateTime = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
};

const pct = (num, den) => {
  const n = Number(num || 0);
  const d = Number(den || 0);
  if (!d) return 0;
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
};

const Badge = ({ kind = 'neutral', children }) => {
  const cls =
    kind === 'ok'
      ? styles.badgeOk
      : kind === 'warn'
        ? styles.badgeWarn
        : kind === 'err'
          ? styles.badgeErr
          : styles.badgeNeutral;
  return <span className={`${styles.badge} ${cls}`}>{children}</span>;
};

const AssetIngestion = () => {
  const [batchId, setBatchId] = useState('');

  const [status, setStatus] = useState(null); // GET status
  const [runs, setRuns] = useState([]); // recent ops
  const [packs, setPacks] = useState([]); // pack list
  const [validateReport, setValidateReport] = useState(null);

  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [loadingValidate, setLoadingValidate] = useState(false);
  const [loadingIngest, setLoadingIngest] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [loadingPacks, setLoadingPacks] = useState(false);

  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [showAllFileChecks, setShowAllFileChecks] = useState(false);

  const pollTimerRef = useRef(null);
  const inFlightStatusRef = useRef(false);

  const envLabel = useMemo(() => {
    const mode = (import.meta?.env?.MODE || '').toUpperCase();
    if (mode) return mode;
    return 'ENV';
  }, []);

  const isLocked = useMemo(() => {
    const exp = status?.status?.lockExpiresAt || status?.lockExpiresAt;
    if (!exp) return false;
    const t = new Date(exp).getTime();
    return Number.isFinite(t) && t > Date.now();
  }, [status]);

  const statusValue = useMemo(() => status?.status?.status || status?.status || null, [status]);
  const phaseValue = useMemo(() => status?.status?.phase || status?.phase || null, [status]);
  const progressValue = useMemo(() => status?.status?.progress || status?.progress || null, [status]);

  const canStartIngest = useMemo(() => {
    if (!batchId.trim()) return false;
    if (loadingIngest || loadingValidate) return false;
    if (validateReport && validateReport.ok === false) return false;
    if (isLocked) return false;
    return true;
  }, [batchId, loadingIngest, loadingValidate, validateReport, isLocked]);

  const fetchRuns = useCallback(async () => {
    setLoadingRuns(true);
    setError(null);
    try {
      const resp = await apiClient.get('/admin/catalog/ingest-batch?limit=50');
      setRuns(resp?.items || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch recent ingestion runs');
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  const fetchPacks = useCallback(async () => {
    setLoadingPacks(true);
    setError(null);
    try {
      const resp = await apiClient.get('/admin/packs?limit=200');
      const list = resp?.packs || [];
      list.sort((a, b) => {
        const ta = a.lastIngestedAt ? new Date(a.lastIngestedAt).getTime() : 0;
        const tb = b.lastIngestedAt ? new Date(b.lastIngestedAt).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      setPacks(list);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch packs');
    } finally {
      setLoadingPacks(false);
    }
  }, []);

  const fetchStatus = useCallback(async (id) => {
    const bid = (id || '').trim();
    if (!bid) return;

    if (inFlightStatusRef.current) return;
    inFlightStatusRef.current = true;

    setLoadingStatus(true);
    setActionError(null);

    try {
      const resp = await apiClient.get(`/admin/catalog/ingest-batch/${encodeURIComponent(bid)}`);
      setStatus(resp?.status || null);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to fetch batch status';
      if (err.response?.status === 404) {
        setStatus(null);
        setActionError('No ingestion operation found for this batch yet.');
      } else {
        setActionError(msg);
      }
    } finally {
      setLoadingStatus(false);
      inFlightStatusRef.current = false;
    }
  }, []);

  const validateBatch = useCallback(async () => {
    const bid = batchId.trim();
    if (!bid) return;

    setLoadingValidate(true);
    setActionError(null);
    setValidateReport(null);

    try {
      const resp = await apiClient.post('/admin/catalog/ingest-batch/validate', { batchId: bid });
      const report = resp?.report;
      setValidateReport(report || null);
      await fetchStatus(bid);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Validation failed');
    } finally {
      setLoadingValidate(false);
    }
  }, [batchId, fetchStatus]);

  const startIngest = useCallback(async () => {
    const bid = batchId.trim();
    if (!bid) return;

    setLoadingIngest(true);
    setActionError(null);

    try {
      await apiClient.post('/admin/catalog/ingest-batch', { batchId: bid });
      await fetchStatus(bid);
      await fetchRuns();
      await fetchPacks();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Ingestion start failed');
    } finally {
      setLoadingIngest(false);
    }
  }, [batchId, fetchPacks, fetchRuns, fetchStatus]);

  const publishPack = useCallback(async (packId) => {
    if (!packId) return;
    setActionError(null);
    try {
      await apiClient.post(`/admin/packs/${encodeURIComponent(packId)}/publish`);
      await fetchPacks();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Publish failed');
    }
  }, [fetchPacks]);

  const unpublishPack = useCallback(async (packId) => {
    if (!packId) return;
    setActionError(null);
    try {
      await apiClient.post(`/admin/packs/${encodeURIComponent(packId)}/unpublish`);
      await fetchPacks();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Unpublish failed');
    }
  }, [fetchPacks]);

  const copyJson = async (obj) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
    } catch {
      // no-op
      alert('Clipboard write failed');
    }
  };

  const openRun = async (bid) => {
    const next = String(bid || '').trim();
    if (!next) return;

    setBatchId(next);
    setValidateReport(null);
    setActionError(null);

    // Force an immediate status fetch and show the spinner even if polling is off
    await fetchStatus(next);

    // Optional: scroll to top so you can see the batch console update
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Initial load
  useEffect(() => {
    fetchRuns();
    fetchPacks();
  }, [fetchRuns, fetchPacks]);

  // Polling
  useEffect(() => {
    if (!pollingEnabled) return;
    const bid = batchId.trim();
    if (!bid) return;

    const isTerminal = statusValue === 'completed' || statusValue === 'failed' || phaseValue === 'complete';
    if (isTerminal) return;

    // only poll if we have a status OR the operator explicitly wants to poll
    // (polling with null status is fine; it will just 404 until op exists)
    const intervalMs = 2500;

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      fetchStatus(bid);
    }, intervalMs);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, [pollingEnabled, batchId, fetchStatus, statusValue, phaseValue]);

  const fileChecks = validateReport?.fileChecks || [];
  const filteredFileChecks = useMemo(() => {
    if (showAllFileChecks) return fileChecks;
    return fileChecks.filter((x) => !x.exists);
  }, [fileChecks, showAllFileChecks]);

  const lockExpiresAt = status?.status?.lockExpiresAt || status?.lockExpiresAt || null;
  const errorMessage = status?.status?.errorMessage || status?.errorMessage || null;

  const objectsUploaded = progressValue?.uploadedObjects ?? 0;
  const objectsTotal = progressValue?.totalObjects ?? 0;
  const stickersApplied = progressValue?.appliedStickers ?? 0;
  const stickersTotal = progressValue?.totalStickers ?? 0;

  const objectsPct = pct(objectsUploaded, objectsTotal);
  const stickersPct = pct(stickersApplied, stickersTotal);

  const statusBadgeKind =
    statusValue === 'completed' ? 'ok' : statusValue === 'failed' ? 'err' : statusValue ? 'warn' : 'neutral';

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Asset Ingestion Ops</h1>
        <Badge kind="neutral">{envLabel}</Badge>
      </div>

      {error && <div className={styles.errorMessage}>{error}</div>}
      {actionError && <div className={styles.warnMessage}>{actionError}</div>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Batch Console</h2>

        <div className={styles.row}>
          <input
            type="text"
            placeholder="batchId (e.g. b_597aed074fdc)"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className={styles.input}
          />

          <button
            onClick={validateBatch}
            disabled={loadingValidate || !batchId.trim()}
            className={styles.button}
          >
            {loadingValidate ? 'Validating…' : 'Validate'}
          </button>

          <button
            onClick={startIngest}
            disabled={!canStartIngest}
            className={styles.buttonPrimary}
            title={
              isLocked
                ? `Locked until ${fmtDateTime(lockExpiresAt)}`
                : validateReport?.ok === false
                  ? 'Fix validation errors first'
                  : ''
            }
          >
            {loadingIngest ? 'Starting…' : 'Start / Resume Ingest'}
          </button>

          <button
            onClick={() => fetchStatus(batchId)}
            disabled={loadingStatus || !batchId.trim()}
            className={styles.button}
          >
            {loadingStatus ? 'Refreshing…' : 'Refresh'}
          </button>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={pollingEnabled}
              onChange={(e) => setPollingEnabled(e.target.checked)}
            />
            Poll
          </label>
        </div>

        <div className={styles.statusRow}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Status</span>
            <Badge kind={statusBadgeKind}>{statusValue || 'n/a'}</Badge>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Phase</span>
            <Badge kind="neutral">{phaseValue || 'n/a'}</Badge>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Lock</span>
            {lockExpiresAt ? (
              <Badge kind={isLocked ? 'warn' : 'neutral'}>
                {isLocked ? `locked until ${fmtDateTime(lockExpiresAt)}` : `expired at ${fmtDateTime(lockExpiresAt)}`}
              </Badge>
            ) : (
              <Badge kind="neutral">none</Badge>
            )}
          </div>
          <div className={styles.statusItem}>
            <button className={styles.linkButton} onClick={() => copyJson(status || {})} disabled={!status}>
              Copy status JSON
            </button>
          </div>
        </div>

        <div className={styles.progressGrid}>
          <div className={styles.progressCard}>
            <div className={styles.progressHeader}>
              <strong>Uploads</strong>
              <span>
                {objectsUploaded} / {objectsTotal}
              </span>
            </div>
            <div className={styles.progressBarOuter}>
              <div className={styles.progressBarInner} style={{ width: `${objectsPct}%` }} />
            </div>
          </div>

          <div className={styles.progressCard}>
            <div className={styles.progressHeader}>
              <strong>DB Apply</strong>
              <span>
                {stickersApplied} / {stickersTotal}
              </span>
            </div>
            <div className={styles.progressBarOuter}>
              <div className={styles.progressBarInner} style={{ width: `${stickersPct}%` }} />
            </div>
          </div>
        </div>

        {(errorMessage || statusValue === 'failed') && (
          <div className={styles.failureBox}>
            <div className={styles.failureHeader}>
              <strong>Failure</strong>
              <div className={styles.failureActions}>
                <button className={styles.button} onClick={startIngest} disabled={!batchId.trim() || loadingIngest}>
                  Retry
                </button>
                <button className={styles.button} onClick={() => copyJson({ status, validateReport })}>
                  Copy debug bundle
                </button>
              </div>
            </div>
            <div className={styles.failureBody}>{errorMessage || 'Failed (no errorMessage provided)'}</div>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <h2 className={styles.sectionTitle}>Validation Report</h2>
          <div className={styles.sectionHeaderActions}>
            <button
              className={styles.linkButton}
              onClick={() => copyJson(validateReport || {})}
              disabled={!validateReport}
            >
              Copy report JSON
            </button>
          </div>
        </div>

        {!validateReport ? (
          <div className={styles.muted}>Run Validate to generate a preflight report.</div>
        ) : (
          <>
            <div className={styles.statusRow}>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>ok</span>
                <Badge kind={validateReport.ok ? 'ok' : 'err'}>{String(validateReport.ok)}</Badge>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>packId</span>
                <Badge kind="neutral">{validateReport?.manifest?.packId || 'n/a'}</Badge>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>objectPrefix</span>
                <Badge kind="neutral">{validateReport?.uploadPlan?.objectPrefix || 'n/a'}</Badge>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>manifestDigest</span>
                <Badge kind="neutral">{(validateReport.manifestDigest || '').slice(0, 10) || 'n/a'}</Badge>
              </div>
            </div>

            {Array.isArray(validateReport.errors) && validateReport.errors.length > 0 && (
              <div className={styles.listBoxErr}>
                <strong>Errors</strong>
                <ul>
                  {validateReport.errors.map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(validateReport.warnings) && validateReport.warnings.length > 0 && (
              <div className={styles.listBoxWarn}>
                <strong>Warnings</strong>
                <ul>
                  {validateReport.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.row}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showAllFileChecks}
                  onChange={(e) => setShowAllFileChecks(e.target.checked)}
                />
                Show all file checks
              </label>
              <div className={styles.muted}>
                Showing {filteredFileChecks.length} of {fileChecks.length}
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                <tr>
                  <th>exists</th>
                  <th>objectKey</th>
                  <th>localPath</th>
                  <th>sha256</th>
                  <th>mime</th>
                </tr>
                </thead>
                <tbody>
                {filteredFileChecks.slice(0, 100).map((f) => (
                  <tr key={f.objectKey}>
                    <td>
                      <Badge kind={f.exists ? 'ok' : 'err'}>{f.exists ? 'yes' : 'no'}</Badge>
                    </td>
                    <td className={styles.mono}>{f.objectKey}</td>
                    <td className={styles.mono}>{f.localPath}</td>
                    <td className={styles.mono}>{(f.sha256 || '').slice(0, 12)}</td>
                    <td className={styles.mono}>{f.mime || ''}</td>
                  </tr>
                ))}
                </tbody>
              </table>
              {filteredFileChecks.length > 100 && (
                <div className={styles.muted}>Showing first 100 rows to keep the page responsive.</div>
              )}
            </div>
          </>
        )}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <h2 className={styles.sectionTitle}>Recent Ingestion Runs</h2>
          <button className={styles.button} onClick={fetchRuns} disabled={loadingRuns}>
            {loadingRuns ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
            <tr>
              <th>batchId</th>
              <th>status</th>
              <th>phase</th>
              <th>progress</th>
              <th>updated</th>
              <th></th>
            </tr>
            </thead>
            <tbody>
            {runs.map((r) => (
              <tr key={r.opId || r.batchId}>
                <td className={styles.mono}>{r.batchId}</td>
                <td>
                  <Badge kind={r.status === 'completed' ? 'ok' : r.status === 'failed' ? 'err' : 'warn'}>
                    {r.status}
                  </Badge>
                </td>
                <td>
                  <Badge kind="neutral">{r.phase || 'n/a'}</Badge>
                </td>
                <td className={styles.mono}>
                  {r.progress?.uploadedObjects ?? 0}/{r.progress?.totalObjects ?? 0} uploads ·{' '}
                  {r.progress?.appliedStickers ?? 0}/{r.progress?.totalStickers ?? 0} db
                </td>
                <td>{fmtDateTime(r.updatedAt)}</td>
                <td>
                  <button className={styles.linkButton} onClick={() => openRun(r.batchId)}>
                    Open
                  </button>
                </td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.muted}>
                  No ingestion runs found.
                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeaderRow}>
          <h2 className={styles.sectionTitle}>Packs</h2>
          <button className={styles.button} onClick={fetchPacks} disabled={loadingPacks}>
            {loadingPacks ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
            <tr>
              <th>name</th>
              <th>published</th>
              <th>last batch</th>
              <th>last ingested</th>
              <th>stickers</th>
              <th>actions</th>
            </tr>
            </thead>
            <tbody>
            {packs.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className={styles.packName}>{p.name}</div>
                  <div className={styles.mutedSmall}>{p.slug}</div>
                </td>
                <td>
                  <Badge kind={p.isActive ? 'ok' : 'neutral'}>{p.isActive ? 'published' : 'draft'}</Badge>
                </td>
                <td className={styles.mono}>{p.lastIngestBatchId || '-'}</td>
                <td>{p.lastIngestedAt ? fmtDateTime(p.lastIngestedAt) : '-'}</td>
                <td className={styles.mono}>{p.stickersCount ?? 0}</td>
                <td className={styles.actionsCell}>
                  {!p.isActive ? (
                    <button className={styles.buttonPrimary} onClick={() => publishPack(p.id)}>
                      Publish
                    </button>
                  ) : (
                    <button className={styles.button} onClick={() => unpublishPack(p.id)}>
                      Unpublish
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {packs.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.muted}>
                  No packs found.
                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default AssetIngestion;
